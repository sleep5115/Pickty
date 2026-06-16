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
 * Pexels 공식 API 기반 사진 후보 공급자.
 *
 * Pixabay가 비어 있을 때 쓰는 fallback. 스톡 사진 특성상 정확한 항목 대표 이미지보다 분위기형 사진이 섞일 수 있다.
 */
@Component
@Order(1)
class PexelsImageSearchProvider(
    @Value("\${pickty.ai.pexels.api-key:}") private val apiKey: String,
) : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)

    private val restClient = RestClient.builder()
        .baseUrl("https://api.pexels.com/v1")
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
                    b.path("/search")
                        .queryParam("query", query)
                        .queryParam("locale", "ko-KR")
                        .queryParam("per_page", maxResults.coerceIn(1, 20))
                        .build()
                }
                .header("Authorization", apiKey)
                .retrieve()
                .body(Map::class.java)

            val photos = response?.get("photos") as? List<*> ?: return emptyList()
            photos.mapNotNull { row ->
                val photo = row as? Map<*, *> ?: return@mapNotNull null
                val src = photo["src"] as? Map<*, *> ?: return@mapNotNull null
                val url = (src["large"] as? String)
                    ?: (src["medium"] as? String)
                    ?: return@mapNotNull null
                val alt = photo["alt"] as? String
                MediaCandidate(url = url, title = alt)
            }.take(maxResults.coerceAtLeast(0))
        } catch (e: Exception) {
            log.warn("Pexels image search failed for keyword='{}'", query, e)
            emptyList()
        }
    }
}
