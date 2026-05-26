package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * `supports(mediaType)`가 true인 전략을 [Order] 우선순위대로 순회하며 호출한다.
 * 어떤 전략이 비어 있지 않은 결과를 반환하면 즉시 채택하고, 비어 있으면 다음 전략을 시도한다.
 *
 * 이미지 검색의 경우 DuckDuckGo → Google(Custom Search; 내부적으로 Bing 폴백) 순으로 시도되며,
 * 외부 서비스가 차단·장애·쿼터 소진으로 빈 결과를 내도 다음 전략으로 자동 복구된다.
 */
@Component
class MediaSearchRouter(
    private val strategies: List<MediaSearchService>,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        val applicable = strategies.filter { it.supports(mediaType) }
        if (applicable.isEmpty()) return emptyList()

        for (strategy in applicable) {
            val candidates = strategy.searchCandidates(keyword, mediaType, maxResults)
            if (candidates.isNotEmpty()) return candidates
            log.warn(
                "Media search strategy {} returned no results for keyword='{}' mediaType={}; trying next strategy",
                strategy.javaClass.simpleName,
                keyword,
                mediaType,
            )
        }
        return emptyList()
    }
}
