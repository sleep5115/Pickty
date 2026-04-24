package com.pickty.server.domain.ai.service

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.pickty.server.domain.ai.dto.AiAutoGenerateItemResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.media.MediaSearchRouter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI
import java.util.concurrent.ThreadLocalRandom
import kotlin.math.min

@Service
class AiGenerationService(
    @Value("\${pickty.ai.gemini.api-key:}") apiKeyRaw: String,
    private val mediaSearchRouter: MediaSearchRouter,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val restClient = RestClient.builder().build()
    private val geminiApiKey: String = apiKeyRaw.trim()

    companion object {
        private const val GEMINI_GENERATE_CONTENT_URI =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"

        /**
         * 첫 시도 + 재시도 4회 = 5회.
         * Gemini는 과부하 시 **500**을 자주 돌려 429/503만 재시도하면 첫 응답에서 바로 실패한다.
         * 재시도: 408, 429, 500, 502, 503, 504 + 네트워크 일시 오류(RestClientException).
         */
        private const val GEMINI_MAX_ATTEMPTS = 5

        private const val CANDIDATES_PER_ITEM = 10
    }

    fun autoGenerate(request: AiAutoGenerateRequest): List<AiAutoGenerateItemResponse> = runBlocking {
        val existing = normalizeExistingItemNames(request.existingItemNames)
        val geminiItems = callGeminiForPrompt(request.prompt.trim(), request.count, request.mediaType, existing)
        val names = geminiItems.items
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(request.count.coerceIn(1, 10))
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

    private suspend fun callGeminiForPrompt(
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

        repeat(GEMINI_MAX_ATTEMPTS) { attempt ->
            try {
                return executeGeminiPost(uri, jsonPayload)
            } catch (e: RestClientResponseException) {
                val code = e.statusCode.value()
                when {
                    code in 400..499 && !isRetryableGeminiHttp(code) -> {
                        log.warn("Gemini client error {} — no retry: {}", code, e.message)
                        throw e
                    }
                    isRetryableGeminiHttp(code) -> {
                        log.warn("Gemini attempt {}/{} retryable HTTP {}: {}", attempt + 1, GEMINI_MAX_ATTEMPTS, code, e.message)
                        if (attempt >= GEMINI_MAX_ATTEMPTS - 1) throw e
                        delayGeminiBackoffWithJitter(retryIndex = attempt)
                    }
                    else -> {
                        log.warn("Gemini HTTP {} — no retry: {}", code, e.message)
                        throw e
                    }
                }
            } catch (e: RestClientException) {
                log.warn("Gemini attempt {}/{} transport error: {}", attempt + 1, GEMINI_MAX_ATTEMPTS, e.message)
                if (attempt >= GEMINI_MAX_ATTEMPTS - 1) throw e
                delayGeminiBackoffWithJitter(retryIndex = attempt)
            }
        }
        error("unreachable")
    }

    /** Gemini·프록시 측 일시 오류에 해당하는 HTTP만 재시도한다. */
    private fun isRetryableGeminiHttp(code: Int): Boolean =
        when (code) {
            408, 429, 500, 502, 503, 504 -> true
            else -> false
        }

    /**
     * 지수 백오프 + 지터. 4회 대기 누적 약 10~15초(지터 포함)가 되도록 간격을 잡음.
     * [retryIndex] 0: 첫 실패 직후, … 3: 네 번째 실패 직후.
     */
    private suspend fun delayGeminiBackoffWithJitter(retryIndex: Int) {
        val exp = 900L * (1L shl min(retryIndex, 3))
        val baseMs = min(4_800L, exp)
        val jitterMs = ThreadLocalRandom.current().nextLong(120, 620)
        delay(baseMs + jitterMs)
    }

    private fun executeGeminiPost(uri: URI, jsonPayload: String): GeminiItemsPayload {
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
        return objectMapper.readValue<GeminiItemsPayload>(cleanText)
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class GeminiItemsPayload(
        val items: List<String> = emptyList(),
    )
}
