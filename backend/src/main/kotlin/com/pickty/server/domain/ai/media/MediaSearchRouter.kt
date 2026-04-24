package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.springframework.stereotype.Component

@Component
class MediaSearchRouter(
    private val strategies: List<MediaSearchService>,
) {
    fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        val strategy = strategies.firstOrNull { it.supports(mediaType) } ?: return emptyList()
        return strategy.searchCandidates(keyword, mediaType, maxResults)
    }
}
