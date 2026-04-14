package com.pickty.server.domain.ai.service

import com.pickty.server.domain.ai.dto.*
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
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI

@Service
class AiTemplateService(
    @Value("\${pickty.ai.gemini.api-key:}") apiKeyRaw: String,
    @Value("\${pickty.google.search.api-key:}") private val googleSearchApiKey: String,
    @Value("\${pickty.google.search.cx:}") private val googleSearchCx: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val restClient = RestClient.builder().build()

    /** YAML/복붙 시 붙는 공백·개행 제거 */
    private val geminiApiKey: String = apiKeyRaw.trim()

    companion object {
        /** gemini-1.5-flash 단종 대응 — v1 + gemini-2.5-flash 고정 */
        private const val GEMINI_GENERATE_CONTENT_URI =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"

        /** 최초 1회 + 재시도 3회 = 총 4회 시도 */
        private const val GEMINI_MAX_RETRIES = 3

        /** 재시도 직전 대기(ms): 1초 → 2초 → 4초 */
        private val GEMINI_BACKOFF_MS = longArrayOf(1_000L, 2_000L, 4_000L)
    }

    /** 관리자용 자동 템플릿 생성 (Phase 1 & 2 통합) */
    fun adminAutoGenerate(request: AdminAutoGenerateRequest): AdminAutoGenerateResponse = runBlocking {
        // Phase 1: Gemini 호출로 아이템 목록 확보
        val geminiResp = callGeminiForTheme(request)

        // Phase 2: 각 아이템에 대해 구글 이미지 검색 (10개씩) 병렬 수행
        val items = geminiResp.items.map { itemName ->
            async(Dispatchers.IO) {
                val urls = searchGoogleImages(itemName, 10)
                AdminAutoGenerateItem(name = itemName, imageUrls = urls)
            }
        }.awaitAll()

        AdminAutoGenerateResponse(
            isPersonOrCharacter = geminiResp.isPersonOrCharacter,
            items = items
        )
    }

    private fun searchGoogleImages(keyword: String, count: Int): List<String> {
        if (googleSearchApiKey.isBlank() || googleSearchCx.isBlank()) return emptyList()

        return try {
            val response = restClient.get()
                .uri { builder ->
                    builder.scheme("https")
                        .host("customsearch.googleapis.com")
                        .path("/customsearch/v1")
                        .queryParam("key", googleSearchApiKey)
                        .queryParam("cx", googleSearchCx)
                        .queryParam("q", keyword)
                        .queryParam("searchType", "image")
                        .queryParam("num", count)
                        .build()
                }
                .retrieve()
                .body(Map::class.java)

            val items = response?.get("items") as? List<*> ?: return emptyList()
            items.mapNotNull { (it as? Map<*, *>)?.get("link") as? String }
        } catch (e: Exception) {
            log.error("Google Image Search failed for: $keyword", e)
            emptyList()
        }
    }

    private suspend fun callGeminiForTheme(request: AdminAutoGenerateRequest): GeminiThemeItemsResponse {
        val promptText = """
            Generate a list of ${request.count} items for a tier list template based on the theme: "${request.theme}".
            
            Return the result ONLY as a valid JSON object with the following structure:
            {
              "theme_type": "short description of theme",
              "is_person_or_character": boolean (true if items are people, fictional characters, or distinct living beings),
              "items": ["Item Name 1", "Item Name 2", ...]
            }
            Do not include any markdown formatting or extra text.
        """.trimIndent()

        val uri = UriComponentsBuilder.fromUriString(GEMINI_GENERATE_CONTENT_URI)
            .queryParam("key", geminiApiKey)
            .build()
            .toUri()

        val escapedPrompt = objectMapper.writeValueAsString(promptText)
        val jsonPayload = """{"contents":[{"parts":[{"text":$escapedPrompt}]}]}"""

        repeat(GEMINI_MAX_RETRIES + 1) { attempt ->
            try {
                return executeGeminiPostForAdmin(uri, jsonPayload)
            } catch (e: Exception) {
                if (attempt >= GEMINI_MAX_RETRIES) throw e
                delay(GEMINI_BACKOFF_MS[attempt])
            }
        }
        error("unreachable")
    }

    private fun executeGeminiPostForAdmin(uri: URI, jsonPayload: String): GeminiThemeItemsResponse {
        val response = restClient.post()
            .uri(uri)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .body(jsonPayload)
            .retrieve()
            .body(Map::class.java)

        val candidates = response?.get("candidates") as? List<*>
        val content = (candidates?.firstOrNull() as? Map<*, *>)?.get("content") as? Map<*, *>
        val parts = content?.get("parts") as? List<*>
        val text = (parts?.firstOrNull() as? Map<*, *>)?.get("text") as? String ?: throw RuntimeException("Empty Gemini response")

        val cleanText = text.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
        return objectMapper.readValue<GeminiThemeItemsResponse>(cleanText)
    }

    /** 기존 유저용 (하위 호환 유지 - 필요 시 수정/제거 가능) */
    fun generateItems(request: AiTemplateItemGenerateRequest): List<AiTemplateItemResponse> = runBlocking {
        // 이 로직도 Google Search로 롤백해야 할 경우 수정 필요
        // 현재는 admin 기능 위주로 구현함. 기존 기능은 Stub 처리하거나 필요 시 위 로직 재활용.
        emptyList()
    }

    private data class AiItemInfo(
        val name: String,
        val searchKeyword: String
    )
}
