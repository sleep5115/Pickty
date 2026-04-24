package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate

/**
 * 미디어 후보 검색 — [GoogleImageSearchProvider], [YouTubeSearchProvider] 등 전략 구현체가 등록된다.
 */
interface MediaSearchService {
    fun supports(mediaType: AiMediaType): Boolean

    fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate>
}
