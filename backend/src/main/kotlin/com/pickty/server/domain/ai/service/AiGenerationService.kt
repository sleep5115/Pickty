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
import org.springframework.web.util.UriComponentsBuilder
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI

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

        private const val GEMINI_MAX_RETRIES = 3
        private val GEMINI_BACKOFF_MS = longArrayOf(1_000L, 2_000L, 4_000L)
        private const val CANDIDATES_PER_ITEM = 10
    }

    fun autoGenerate(request: AiAutoGenerateRequest): List<AiAutoGenerateItemResponse> = runBlocking {
        val geminiItems = callGeminiForPrompt(request.prompt.trim(), request.count, request.mediaType)
        val names = geminiItems.items
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(request.count.coerceIn(1, 50))
        if (names.isEmpty()) return@runBlocking emptyList()

        val rows = names.map { name ->
            async(Dispatchers.IO) {
                val candidates = mediaSearchRouter.searchCandidates(name, request.mediaType, CANDIDATES_PER_ITEM)
                AiAutoGenerateItemResponse(name = name, candidates = candidates)
            }
        }.awaitAll()

        rows
    }

    private suspend fun callGeminiForPrompt(
        prompt: String,
        count: Int,
        mediaType: AiMediaType,
    ): GeminiItemsPayload {
        val mediaHint = when (mediaType) {
            AiMediaType.PHOTO -> "still photo / artwork thumbnails"
            AiMediaType.GIF -> "animated GIF clips or short looping visuals"
            AiMediaType.YOUTUBE -> "YouTube videos (search will target watch URLs)"
        }

        val promptText = """
            Generate exactly $count distinct item labels for a visual elimination bracket or world-cup style poll (no more, no fewer).
            Theme or subject: "$prompt"
            Each item should be a concise display name (under 80 characters) suitable for finding $mediaHint via web search.
            
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

        repeat(GEMINI_MAX_RETRIES + 1) { attempt ->
            try {
                return executeGeminiPost(uri, jsonPayload)
            } catch (e: Exception) {
                log.warn("Gemini attempt {} failed: {}", attempt + 1, e.message)
                if (attempt >= GEMINI_MAX_RETRIES) throw e
                delay(GEMINI_BACKOFF_MS[attempt])
            }
        }
        error("unreachable")
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
