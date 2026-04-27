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

    private fun normalizeExistingItemNames(raw: List<String>): List<String> =
        raw.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(200)

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

    private fun executeGeminiPost(uri: URI, jsonPayload: String): GeminiItemsPayload {
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

        val cleanText = text.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
        val payload = objectMapper.readValue<GeminiItemsPayload>(cleanText)
        return payload
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class GeminiItemsPayload(
        val items: List<String> = emptyList(),
    )
}
