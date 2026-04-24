package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException

@Component
class GoogleImageSearchProvider(
    @Value("\${pickty.ai.google-search.api-key:}") private val googleSearchApiKey: String,
    @Value("\${pickty.ai.google-search.cx:}") private val googleSearchCx: String,
    private val bingImageSearchProvider: BingImageSearchProvider,
) : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)
    private val restClient = RestClient.builder().build()

    override fun supports(mediaType: AiMediaType): Boolean =
        mediaType == AiMediaType.PHOTO || mediaType == AiMediaType.GIF

    override fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        val preferGif = mediaType == AiMediaType.GIF
        return try {
            searchGoogleCustomSearch(keyword, maxResults, preferGif)
        } catch (e: RestClientResponseException) {
            if (e.statusCode == HttpStatus.TOO_MANY_REQUESTS) {
                log.warn("Google Custom Search 429 for keyword='{}', trying Bing fallback", keyword)
                return bingImageSearchProvider.searchImageLinks(keyword, maxResults, preferGif)
            }
            log.error("Google Custom Search failed for keyword='{}' status={}", keyword, e.statusCode, e)
            emptyList()
        } catch (e: Exception) {
            log.error("Google Custom Search failed for keyword='{}'", keyword, e)
            emptyList()
        }
    }

    private fun searchGoogleCustomSearch(keyword: String, count: Int, preferGif: Boolean): List<MediaCandidate> {
        if (googleSearchApiKey.isBlank() || googleSearchCx.isBlank()) return emptyList()
        val q = if (preferGif) "$keyword animated gif" else keyword

        val response = restClient.get()
            .uri { builder ->
                val b = builder.scheme("https")
                    .host("customsearch.googleapis.com")
                    .path("/customsearch/v1")
                    .queryParam("key", googleSearchApiKey)
                    .queryParam("cx", googleSearchCx)
                    .queryParam("q", q)
                    .queryParam("searchType", "image")
                    .queryParam("num", count.coerceIn(1, 10))
                if (preferGif) {
                    b.queryParam("fileType", "gif")
                }
                b.build()
            }
            .retrieve()
            .body(Map::class.java)

        val items = response?.get("items") as? List<*> ?: return emptyList()
        return items.mapNotNull { (it as? Map<*, *>)?.get("link") as? String }
            .map { link -> MediaCandidate(url = link, title = null) }
    }
}
