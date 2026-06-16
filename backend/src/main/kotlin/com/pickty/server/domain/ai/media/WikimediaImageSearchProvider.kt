package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration
import java.util.concurrent.Semaphore

/**
 * 한국어 위키백과(ko.wikipedia) Action API 기반 이미지 후보 공급자.
 *
 * DuckDuckGo 스크래핑과 달리 **공식 무료 API**라 데이터센터(서버) IP에서도 막힘 없이 동작한다.
 * 단, Commons에 자유 이미지가 있는 **백과사전 등재 대상**만 커버된다(저작권 캐릭터·마이너 항목 제외).
 *
 * 관련성 우선 전략:
 *  1) 항목명과 **정확히 일치하는 문서**의 대표 이미지(`pageimages`). redirect 추적.
 *  2) 없으면 검색 결과 중 **제목 핵심어가 항목명에 포함**되는 첫 이미지(그룹·동음이의 오매칭 방지).
 *  3) 둘 다 없으면 빈 결과 → 호출 측에서 해당 아이템을 버린다.
 *
 * PHOTO 마지막 공식 fallback. Pixabay/Pexels가 비어 있을 때만 시도한다.
 */
@Component
@Order(20)
class WikimediaImageSearchProvider : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)

    // autoGenerate가 아이템 100개를 병렬 검색하므로, Wikimedia 동시성 권고에 맞춰 동시 요청 수를 제한한다.
    private val concurrencyLimiter = Semaphore(MAX_CONCURRENCY)

    private val restClient = RestClient.builder()
        .baseUrl("https://ko.wikipedia.org/w/api.php")
        // Wikimedia UA 정책 — 식별 가능한 User-Agent 미지정 시 차단될 수 있음.
        .defaultHeader("User-Agent", USER_AGENT)
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(3))
                setReadTimeout(Duration.ofSeconds(7))
            },
        )
        .build()

    override fun supports(mediaType: AiMediaType): Boolean = mediaType == AiMediaType.PHOTO

    override fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> {
        val name = keyword.trim()
        if (name.isEmpty()) return emptyList()
        concurrencyLimiter.acquire()
        return try {
            (exactTitleImage(name) ?: searchBestMatchImage(name))
                ?.let { listOf(it) }
                ?: emptyList()
        } catch (e: Exception) {
            log.warn("Wikimedia image search failed for keyword='{}'", name, e)
            emptyList()
        } finally {
            concurrencyLimiter.release()
        }
    }

    /** 항목명과 정확히 일치하는(리다이렉트 포함) 문서의 대표 이미지. */
    private fun exactTitleImage(name: String): MediaCandidate? {
        val response = restClient.get()
            .uri { b ->
                b.queryParam("action", "query")
                    .queryParam("format", "json")
                    .queryParam("redirects", "1")
                    .queryParam("titles", name)
                    .queryParam("prop", "pageimages")
                    .queryParam("piprop", "thumbnail")
                    .queryParam("pithumbsize", THUMB_SIZE)
                    .build()
            }
            .retrieve()
            .body(Map::class.java)

        val page = pagesOf(response).firstOrNull() ?: return null
        return candidateFromPage(page)
    }

    /** 검색 결과(검색 순위 순) 중 제목 핵심어가 항목명에 부합하는 첫 이미지. */
    private fun searchBestMatchImage(name: String): MediaCandidate? {
        val response = restClient.get()
            .uri { b ->
                b.queryParam("action", "query")
                    .queryParam("format", "json")
                    .queryParam("generator", "search")
                    .queryParam("gsrsearch", name)
                    .queryParam("gsrlimit", SEARCH_LIMIT)
                    .queryParam("gsrnamespace", "0")
                    .queryParam("prop", "pageimages")
                    .queryParam("piprop", "thumbnail")
                    .queryParam("pithumbsize", THUMB_SIZE)
                    .build()
            }
            .retrieve()
            .body(Map::class.java)

        return pagesOf(response)
            .sortedBy { (it["index"] as? Number)?.toInt() ?: Int.MAX_VALUE }
            .firstNotNullOfOrNull { page ->
                val title = page["title"] as? String ?: return@firstNotNullOfOrNull null
                if (!titleMatches(name, title)) return@firstNotNullOfOrNull null
                candidateFromPage(page)
            }
    }

    @Suppress("UNCHECKED_CAST")
    private fun pagesOf(response: Map<*, *>?): List<Map<String, Any?>> {
        val query = response?.get("query") as? Map<*, *> ?: return emptyList()
        val pages = query["pages"] as? Map<*, *> ?: return emptyList()
        return pages.values.mapNotNull { it as? Map<String, Any?> }
    }

    private fun candidateFromPage(page: Map<String, Any?>): MediaCandidate? {
        val thumbnail = page["thumbnail"] as? Map<*, *> ?: return null
        val source = (thumbnail["source"] as? String)?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val title = (page["title"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        return MediaCandidate(url = source, title = title)
    }

    /** 제목(괄호 동음이의 제거)의 핵심어가 항목명과 한쪽이 다른 쪽을 포함하면 매칭으로 본다. */
    private fun titleMatches(query: String, title: String): Boolean {
        val q = normalize(query)
        val t = normalize(title.substringBefore('(').trim())
        if (q.isEmpty() || t.isEmpty()) return false
        return q.contains(t) || t.contains(q)
    }

    private fun normalize(s: String): String = s.lowercase().replace(WHITESPACE, "")

    companion object {
        private const val USER_AGENT = "PicktyBot/1.0 (+https://pickty.app; auto worldcup/tier image lookup)"
        private const val THUMB_SIZE = "1024"
        private const val SEARCH_LIMIT = "5"
        private const val MAX_CONCURRENCY = 4
        private val WHITESPACE = Regex("\\s+")
    }
}
