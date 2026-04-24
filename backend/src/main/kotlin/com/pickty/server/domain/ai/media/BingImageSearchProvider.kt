package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Component

/**
 * Bing 이미지 검색 폴백용 스텁. API 키·엔드포인트 연동 시 [searchImageLinks] 구현을 채우면 된다.
 */
@Component
class BingImageSearchProvider {
    private val log = LoggerFactory.getLogger(javaClass)

    fun searchImageLinks(keyword: String, maxResults: Int, preferGif: Boolean): List<MediaCandidate> {
        log.debug(
            "Bing image search stub (no-op): keyword='{}' maxResults={} preferGif={}",
            keyword,
            maxResults,
            preferGif,
        )
        return emptyList()
    }
}
