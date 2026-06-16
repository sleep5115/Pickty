package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.annotation.Order
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration

/**
 * Pixabay 공식 API 기반 사진 후보 공급자.
 *
 * 가벼운 음식·동물·자연·여행·사물 주제에 맞고, 받은 이미지는 기존 배치 흐름에서 R2로 재저장한다.
 */
@Component
@Order(0)
class PixabayImageSearchProvider(
    @Value("\${pickty.ai.pixabay.api-key:}") private val apiKey: String,
) : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)

    private val restClient = RestClient.builder()
        .baseUrl("https://pixabay.com/api/")
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(3))
                setReadTimeout(Duration.ofSeconds(7))
            },
        )
        .build()

    override fun supports(mediaType: AiMediaType): Boolean = mediaType == AiMediaType.PHOTO

    override fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        val query = keyword.trim()
        if (apiKey.isBlank() || query.isEmpty()) return emptyList()
        return try {
            val response = restClient.get()
                .uri { b ->
                    b.queryParam("key", apiKey)
                        .queryParam("q", query)
                        .queryParam("lang", "ko")
                        .queryParam("image_type", "photo")
                        .queryParam("safesearch", "true")
                        .queryParam("per_page", maxResults.coerceIn(3, 20))
                        .build()
                }
                .retrieve()
                .body(Map::class.java)

            val hits = response?.get("hits") as? List<*> ?: return emptyList()
            hits.mapNotNull { row ->
                val hit = row as? Map<*, *> ?: return@mapNotNull null
                val url = (hit["largeImageURL"] as? String)
                    ?: (hit["webformatURL"] as? String)
                    ?: return@mapNotNull null
                val tags = hit["tags"] as? String
                MediaCandidate(url = url, title = tags)
            }.take(maxResults.coerceAtLeast(0))
        } catch (e: Exception) {
            log.warn("Pixabay image search failed for keyword='{}'", query, e)
            emptyList()
        }
    }
}
