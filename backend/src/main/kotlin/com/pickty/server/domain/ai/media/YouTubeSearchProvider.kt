package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

@Component
class YouTubeSearchProvider(
    @Value("\${pickty.ai.youtube.data-api-key:}") private val youtubeDataApiKey: String,
) : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = RestClient.builder().build()

    override fun supports(mediaType: AiMediaType): Boolean = mediaType == AiMediaType.YOUTUBE

    override fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        if (youtubeDataApiKey.isBlank()) {
            log.warn("pickty.ai.youtube.data-api-key is blank; YouTube search returns no candidates")
            return emptyList()
        }
        val n = maxResults.coerceIn(1, 10)
        return try {
            val response = restClient.get()
                .uri { builder ->
                    builder.scheme("https")
                        .host("www.googleapis.com")
                        .path("/youtube/v3/search")
                        .queryParam("part", "snippet")
                        .queryParam("type", "video")
                        .queryParam("maxResults", n)
                        .queryParam("q", keyword)
                        .queryParam("key", youtubeDataApiKey)
                        .build()
                }
                .retrieve()
                .body(Map::class.java)

            val items = response?.get("items") as? List<*> ?: return emptyList()
            items.mapNotNull { item ->
                val row = item as? Map<*, *> ?: return@mapNotNull null
                val id = row["id"] as? Map<*, *> ?: return@mapNotNull null
                val vid = id["videoId"] as? String ?: return@mapNotNull null
                val snippet = row["snippet"] as? Map<*, *>
                val rawTitle = snippet?.get("title") as? String
                val title = rawTitle?.trim()?.takeIf { it.isNotEmpty() }
                MediaCandidate(
                    url = "https://www.youtube.com/watch?v=$vid",
                    title = title,
                )
            }
        } catch (e: Exception) {
            log.error("YouTube Data API search failed for keyword='{}'", keyword, e)
            emptyList()
        }
    }
}
