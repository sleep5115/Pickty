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

        /** 일시적 5xx(특히 503 UNAVAILABLE "high demand") 재시도 횟수·백오프. 일일 쿼터 소진은 재시도 안 함. */
        private const val GEMINI_TRANSIENT_RETRIES = 2
        private const val GEMINI_RETRY_BASE_MS = 2000L
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

    /**
     * 이미지 자동 생성 배치용 — **위키백과에 자유 이미지가 있을 법한 주제**로 유도한다.
     * 반환 `title`은 분류어("월드컵"/"티어표")가 없는 **주제 문구**이며, 호출 측이 종류에 맞게 접미어를 붙인다.
     */
    fun generateImageTopic(excludedTitles: List<String>): GeneratedTopic {
        val excluded = normalizeExistingItemNames(excludedTitles)
        val payload = callGeminiForImageTopic(excluded)
        val title = payload.title.trim()
        require(title.isNotEmpty()) { "Gemini returned empty image topic" }
        return GeneratedTopic(title = title, itemCount = payload.itemCount.coerceIn(2, 100))
    }

    private fun normalizeExistingItemNames(raw: List<String>): List<String> =
        raw.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(200)

    private fun callGeminiForImageTopic(excludedTitles: List<String>): GeminiTopicPayload {
        val avoid = if (excludedTitles.isNotEmpty()) {
            val json = objectMapper.writeValueAsString(excludedTitles)
            "\n\nThese subjects already exist — yours MUST be clearly different. EXISTING: $json"
        } else {
            ""
        }

        val promptText = """
            Propose ONE subject for a Korean image-based popularity poll (이상형 월드컵 / 티어표).
            CRITICAL: every item in this subject must be an individually notable entity that almost certainly has
            its OWN Korean Wikipedia (ko.wikipedia.org) article containing a FREELY-LICENSED photo.
            GOOD subjects: real people (운동선수, 배우, 솔로 가수, 정치인), animal species(동물 품종), foods(음식),
            countries/cities, landmarks, classic/old films.
            AVOID: copyrighted fictional characters (애니·게임·웹툰 캐릭터), idol group members, brand-new memes,
            niche/obscure items, or anything unlikely to have a free Wikipedia photo.
            Write the subject in Korean WITHOUT a trailing "월드컵"/"티어표" word.
            Estimate how many such items genuinely exist (be realistic, do NOT pad).$avoid

            Return ONLY valid JSON (no markdown):
            {
              "title": "<subject phrase in Korean, under 60 characters>",
              "itemCount": <integer between 2 and 100>
            }
        """.trimIndent()

        return objectMapper.readValue<GeminiTopicPayload>(callGemini(promptText))
    }

    private fun callGeminiForTopic(excludedTitles: List<String>): GeminiTopicPayload {
        val avoid = if (excludedTitles.isNotEmpty()) {
            val json = objectMapper.writeValueAsString(excludedTitles)
            "\n\nThese titles already exist. Your topic AND its title style MUST be clearly different from them — " +
                "not just a different subject, but a different phrasing/format too. EXISTING TITLES: $json"
        } else {
            ""
        }

        val promptText = """
            You are planning a new "이상형 월드컵" (an image/video elimination-bracket popularity poll) for a Korean UGC platform.
            Propose exactly ONE fresh, fun topic that Korean users would enjoy. Write the title in Korean.
            Vary the title's wording and structure — do NOT default to a fixed pattern like "최애 ○○ 월드컵" or always
            opening with the same word (최애/최고/인기). Use diverse, natural, catchy Korean phrasings (e.g. "추억의 ○○",
            "역대 ○○ TOP", "인생 ○○", "○○ 끝판왕", or just the subject itself) — make titles feel human and varied, not templated.
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
     * 쿼터 소진은 [AiQuotaExhaustedException]로 즉시 실패, 일시적 5xx(503 등)는 짧은 백오프로 재시도,
     * 그 외 HTTP 오류는 즉시 전파한다.
     */
    private fun callGemini(promptText: String): String {
        val uri = UriComponentsBuilder.fromUriString(GEMINI_GENERATE_CONTENT_URI)
            .queryParam("key", geminiApiKey)
            .build()
            .toUri()

        val escapedPrompt = objectMapper.writeValueAsString(promptText)
        val jsonPayload = """{"contents":[{"parts":[{"text":$escapedPrompt}]}]}"""

        var attempt = 0
        while (true) {
            try {
                return executeGeminiPost(uri, jsonPayload)
            } catch (e: RestClientResponseException) {
                val responseSummary = summarizeGeminiError(e)
                // 일일 쿼터 소진은 재시도 무의미 — 즉시 실패.
                if (isGeminiQuotaExhaustedResponse(e)) {
                    log.warn(
                        "Gemini daily quota exhausted HTTP {} — fast-fail, no retry: {}",
                        e.statusCode.value(),
                        responseSummary,
                    )
                    throw AiQuotaExhaustedException()
                }
                // 503 등 일시적 5xx 과부하는 짧은 백오프로 재시도(무인 배치가 일시 블립에 통째로 죽지 않도록).
                if (e.statusCode.is5xxServerError && attempt < GEMINI_TRANSIENT_RETRIES) {
                    attempt++
                    val backoffMs = GEMINI_RETRY_BASE_MS * (1L shl (attempt - 1))
                    log.warn(
                        "Gemini HTTP {} transient — retry {}/{} after {}ms: {}",
                        e.statusCode.value(), attempt, GEMINI_TRANSIENT_RETRIES, backoffMs, responseSummary,
                    )
                    Thread.sleep(backoffMs)
                    continue
                }
                log.warn(
                    "Gemini HTTP {} — giving up after {} attempt(s): {}",
                    e.statusCode.value(), attempt + 1, responseSummary,
                )
                throw e
            }
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
