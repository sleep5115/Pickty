package com.pickty.server.domain.ai.service

import com.pickty.server.domain.ai.dto.AiTemplateItemGenerateRequest
import com.pickty.server.domain.ai.dto.AiTemplateItemResponse
import com.pickty.server.domain.ai.dto.FocusRect
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
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI
import java.util.UUID

@Service
class AiTemplateService(
    @Value("\${pickty.ai.gemini.api-key:}") apiKeyRaw: String,
    @Value("\${pickty.ai.bing-search.api-key:}") private val bingSearchApiKey: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val restClient = RestClient.builder().build()

    /** YAML/복붙 시 붙는 공백·개행 제거 */
    private val geminiApiKey: String = apiKeyRaw.trim()

    companion object {
        /** Bing Image Search API 엔드포인트 */
        private const val BING_IMAGE_SEARCH_URL = "https://api.bing.microsoft.com/v7.0/images/search"

        /** gemini-1.5-flash 단종 대응 — v1 + gemini-2.5-flash 고정 */
        private const val GEMINI_GENERATE_CONTENT_URI =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"
...
    fun generateItems(request: AiTemplateItemGenerateRequest): List<AiTemplateItemResponse> = runBlocking {
        // Phase 1: LLM 호출 (텍스트 생성)
        val aiItems = if (geminiApiKey.isBlank()) {
            log.warn("Gemini API Key is not configured. Returning empty list.")
            emptyList()
        } else {
            callGeminiWithRetry(request)
        }

        // Phase 2 (Search API) & Phase 3 (Vision Crop)
        // 병렬 검색 수행
        aiItems.map { item ->
            async(Dispatchers.IO) {
                // Phase 2 - Bing Image Search API
                val imageUrl = searchImage(item.searchKeyword)

                // TODO: Phase 3 - Vision 모델(또는 클라이언트 사이드 face-api.js)로 focusRect 추출
                AiTemplateItemResponse(
                    id = UUID.randomUUID().toString(),
                    name = item.name,
                    imageUrl = imageUrl ?: "https://img.pickty.app/stub-ai-generated.webp",
                    focusRect = FocusRect(0.0, 0.0, 1.0, 1.0) // Dummy Rect (전체)
                )
            }
        }.awaitAll()
    }

    private fun searchImage(keyword: String): String? {
        if (bingSearchApiKey.isBlank()) return null

        return try {
            val response = restClient.get()
                .uri { builder ->
                    builder.fromUriString(BING_IMAGE_SEARCH_URL)
                        .queryParam("q", keyword)
                        .queryParam("count", 1)
                        .queryParam("imageType", "Photo")
                        .queryParam("safeSearch", "Moderate")
                        .build()
                }
                .header("Ocp-Apim-Subscription-Key", bingSearchApiKey)
                .retrieve()
                .body(Map::class.java)

            val value = response?.get("value") as? List<*>
            val firstItem = value?.firstOrNull() as? Map<*, *>
            val contentUrl = firstItem?.get("contentUrl") as? String
            
            log.debug("Bing Search result for '{}': {}", keyword, contentUrl)
            contentUrl
        } catch (e: Exception) {
            log.error("Error searching image via Bing for keyword: $keyword", e)
            null
        }
    }

    private suspend fun callGeminiWithRetry(request: AiTemplateItemGenerateRequest): List<AiItemInfo> {
        val promptText = """
            Generate a list of ${request.requireCount} items for a tier list template based on the following topic: "${request.prompt}".
            
            Rules:
            1. Exclude these items: ${request.excludeItems.joinToString(", ")}.
            2. For each item, provide:
               - 'name': The name in 'Korean_English' format (e.g., "유우카_Yuuka"). If the official English name is unknown, use its romanization.
               - 'searchKeyword': A specific keyword for Bing Image Search. It must include the series name and character name in English to find a high-quality, representative square photo (e.g., "Blue Archive Yuuka official art").
            3. Return the result ONLY as a valid JSON array of objects. Do not include any other text or markdown formatting.
            
            Example Format:
            [
              {"name": "유우카_Yuuka", "searchKeyword": "Blue Archive Yuuka official art"}
            ]
        """.trimIndent()

        val uri = UriComponentsBuilder.fromUriString(GEMINI_GENERATE_CONTENT_URI)
            .queryParam("key", geminiApiKey)
            .build()
            .toUri()

        val escapedPrompt = objectMapper.writeValueAsString(promptText)

        val jsonPayload = """
            {
              "contents": [
                {
                  "parts": [
                    {
                      "text": $escapedPrompt
                    }
                  ]
                }
              ]
            }
        """.trimIndent()

        repeat(GEMINI_MAX_RETRIES + 1) { attempt ->
            try {
                return executeGeminiPost(uri, jsonPayload)
            } catch (e: RestClientResponseException) {
                if (!isGeminiRetryable(e)) {
                    log.error("Gemini 클라이언트 오류(재시도 안 함): status={}, body={}", e.statusCode, e.responseBodyAsString)
                    throw e
                }
                if (attempt >= GEMINI_MAX_RETRIES) {
                    log.error(
                        "Gemini API 실패 — {}회 시도 후 종료: status={}, body={}",
                        GEMINI_MAX_RETRIES + 1,
                        e.statusCode,
                        e.responseBodyAsString,
                    )
                    throw e
                }
                val waitMs = GEMINI_BACKOFF_MS[attempt]
                log.warn(
                    "Gemini 일시 오류 {} — {}ms 후 재시도 ({}/{})",
                    e.statusCode,
                    waitMs,
                    attempt + 2,
                    GEMINI_MAX_RETRIES + 1,
                )
                delay(waitMs)
            }
        }
        error("unreachable")
    }

    private fun isGeminiRetryable(e: RestClientResponseException): Boolean {
        val code = e.statusCode
        return code.is5xxServerError || code.value() == 429
    }

    /** HTTP 오류 시 [RestClientResponseException]만 상위로 — 200 본문 파싱 실패는 일반 예외 */
    private fun executeGeminiPost(uri: URI, jsonPayload: String): List<AiItemInfo> {
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

        if (text != null) {
            val cleanText = text.trim()
                .removePrefix("```json")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()
            return objectMapper.readValue<List<AiItemInfo>>(cleanText)
        }

        log.error("Gemini response missing text. Raw keys: {}", response?.keys)
        return emptyList()
    }

    private data class AiItemInfo(
        val name: String,
        val searchKeyword: String
    )
}
