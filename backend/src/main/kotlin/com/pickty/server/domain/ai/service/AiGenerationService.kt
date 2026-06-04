package com.pickty.server.domain.ai.service

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.pickty.server.domain.ai.dto.AiAutoGenerateItemResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.media.MediaSearchRouter
import com.pickty.server.global.exception.AiQuotaExhaustedException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI

@Service
class AiGenerationService(
    @Value("\${pickty.ai.gemini.api-key:}") apiKeyRaw: String,
    private val mediaSearchRouter: MediaSearchRouter,
    private val aiApiUsageService: AiApiUsageService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val restClient = RestClient.builder().build()
    private val geminiApiKey: String = apiKeyRaw.trim()

    companion object {
        private const val GEMINI_GENERATE_CONTENT_URI =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"

        private const val CANDIDATES_PER_ITEM = 10
    }

    fun autoGenerate(request: AiAutoGenerateRequest): List<AiAutoGenerateItemResponse> = runBlocking {
        val existing = normalizeExistingItemNames(request.existingItemNames)
        val geminiItems = callGeminiForPrompt(request.prompt.trim(), request.count, request.mediaType, existing)
        val names = geminiItems.items
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(request.count.coerceIn(1, 100))
        if (names.isEmpty()) return@runBlocking emptyList()

        val rows = names.map { name ->
            async(Dispatchers.IO) {
                val candidates = mediaSearchRouter.searchCandidates(name, request.mediaType, CANDIDATES_PER_ITEM)
                AiAutoGenerateItemResponse(name = name, candidates = candidates)
            }
        }.awaitAll()

        rows
    }

    /**
     * 자동 생성 스케줄러용 — 기존 주제(템플릿 제목 등)와 겹치지 않는 새 이상형 월드컵 주제 1개와,
     * 그 주제에 자연스럽게 속하는 아이템 수를 함께 받는다. (억지 패딩 없이 주제 규모를 따르기 위함)
     */
    fun generateTopic(excludedTitles: List<String>): GeneratedTopic {
        val excluded = normalizeExistingItemNames(excludedTitles)
        val payload = callGeminiForTopic(excluded)
        val title = payload.title.trim()
        require(title.isNotEmpty()) { "Gemini returned empty topic title" }
        return GeneratedTopic(title = title, itemCount = payload.itemCount.coerceIn(2, 100))
    }

    private fun normalizeExistingItemNames(raw: List<String>): List<String> =
        raw.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(200)

    private fun callGeminiForTopic(excludedTitles: List<String>): GeminiTopicPayload {
        val avoid = if (excludedTitles.isNotEmpty()) {
            val json = objectMapper.writeValueAsString(excludedTitles)
            "\n\nThese topics already exist — your topic MUST be clearly different (not a reworded duplicate). EXISTING TOPICS: $json"
        } else {
            ""
        }

        val promptText = """
            You are planning a new "이상형 월드컵" (an image/video elimination-bracket popularity poll) for a Korean UGC platform.
            Propose exactly ONE fresh, fun topic that Korean users would enjoy. Write the title in Korean.
            Also estimate how many distinct, well-known, individually web-searchable items naturally belong to this topic
            (example: "좋아하는 알파벳 월드컵" → 26). Be realistic and do NOT pad the number — only count items that genuinely exist for the topic.$avoid

            Return ONLY valid JSON (no markdown) with this shape:
            {
              "title": "<a worldcup title in Korean, under 80 characters>",
              "itemCount": <integer between 2 and 100>
            }
        """.trimIndent()

        return objectMapper.readValue<GeminiTopicPayload>(callGemini(promptText))
    }

    private fun callGeminiForPrompt(
        prompt: String,
        count: Int,
        mediaType: AiMediaType,
        existingItemNames: List<String>,
    ): GeminiItemsPayload {
        val mediaHint = when (mediaType) {
            AiMediaType.PHOTO -> "still photo / artwork thumbnails"
            AiMediaType.GIF -> "animated GIF clips or short looping visuals"
            AiMediaType.YOUTUBE -> "YouTube videos (search will target watch URLs)"
        }

        val criticalExclusion = if (existingItemNames.isNotEmpty()) {
            val excludedJson = objectMapper.writeValueAsString(existingItemNames)
            """
            
            CRITICAL CONSTRAINT: You MUST NOT generate any of the following items. They are already in the list. Provide completely new and unique items only. EXCLUDED ITEMS: $excludedJson
            """.trimIndent()
        } else {
            ""
        }

        val promptText = """
            Generate exactly $count distinct item labels for a visual elimination bracket or world-cup style poll (no more, no fewer).
            Theme or subject: "$prompt"
            Each item should be a concise display name (under 80 characters) suitable for finding $mediaHint via web search.
            $criticalExclusion
            
            Return ONLY valid JSON (no markdown) with this shape:
            {
              "items": ["Label 1", "Label 2", ...]
            }
            The "items" array must contain exactly $count strings.
        """.trimIndent()

        return objectMapper.readValue<GeminiItemsPayload>(callGemini(promptText))
    }

    /**
     * Gemini generateContent 호출 → 응답 텍스트(마크다운 펜스 제거)까지 반환.
     * 쿼터 소진은 [AiQuotaExhaustedException], 그 외 HTTP 오류는 재시도 없이 즉시 전파한다.
     */
    private fun callGemini(promptText: String): String {
        val uri = UriComponentsBuilder.fromUriString(GEMINI_GENERATE_CONTENT_URI)
            .queryParam("key", geminiApiKey)
            .build()
            .toUri()

        val escapedPrompt = objectMapper.writeValueAsString(promptText)
        val jsonPayload = """{"contents":[{"parts":[{"text":$escapedPrompt}]}]}"""

        try {
            return executeGeminiPost(uri, jsonPayload)
        } catch (e: RestClientResponseException) {
            val responseSummary = summarizeGeminiError(e)
            if (isGeminiQuotaExhaustedResponse(e)) {
                log.warn(
                    "Gemini daily quota exhausted HTTP {} — fast-fail, no retry: {}",
                    e.statusCode.value(),
                    responseSummary,
                )
                throw AiQuotaExhaustedException()
            }
            log.warn("Gemini HTTP {} — fast-fail, no retry: {}", e.statusCode.value(), responseSummary)
            throw e
        }
    }

    /**
     * Google 측 **일일 생성 할당량** 소진 시 응답/메시지에 포함되는 토큰.
     *
     * 429나 RESOURCE_EXHAUSTED만으로는 분당 제한·일시 과부하와 구분할 수 없으므로,
     * 클라이언트에 "오늘 20회 소진" 안내를 띄울 때는 daily quota 토큰으로만 판정한다.
     * 실패 요청도 쿼터에 잡힐 수 있으므로 재시도 없이 즉시 실패 처리한다.
     */
    private fun isGeminiQuotaExhaustedResponse(e: RestClientResponseException): Boolean {
        val buf = StringBuilder()
        e.message?.let { buf.append('\n').append(it) }
        buf.append('\n').append(e.responseBodyAsString ?: "")
        val blob = buf.toString()
        return blob.contains("GenerateRequestsPerDay") ||
            blob.contains("GenerateRequestsPerDayPerProjectPerModel-FreeTier")
    }

    private fun summarizeGeminiError(e: RestClientResponseException): String {
        val body = e.responseBodyAsString?.trim().orEmpty()
        val raw = if (body.isNotEmpty()) body else e.message.orEmpty()
        return raw
            .replace(Regex("\\s+"), " ")
            .take(800)
            .ifBlank { "(empty response body)" }
    }

    private fun executeGeminiPost(uri: URI, jsonPayload: String): String {
        aiApiUsageService.recordGeminiGenerateContentCall()
        val response = restClient.post()
            .uri(uri)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .body(jsonPayload)
            .retrieve()
            .body(Map::class.java)

        val candidates = response?.get("candidates") as? List<*>
        val content = (candidates?.firstOrNull() as? Map<*, *>)?.get("content") as? Map<*, *>
        val parts = content?.get("parts") as? List<*>
        val text = (parts?.firstOrNull() as? Map<*, *>)?.get("text") as? String
            ?: throw IllegalStateException("Empty Gemini response")

        return text.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
    }

    /** 스케줄러가 사용하는 주제 생성 결과 — 제목과 그 주제의 자연스러운 아이템 수. */
    data class GeneratedTopic(
        val title: String,
        val itemCount: Int,
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class GeminiItemsPayload(
        val items: List<String> = emptyList(),
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class GeminiTopicPayload(
        val title: String = "",
        val itemCount: Int = 0,
    )
}
