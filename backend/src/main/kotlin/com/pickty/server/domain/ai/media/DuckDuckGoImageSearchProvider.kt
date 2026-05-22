package com.pickty.server.domain.ai.media

import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.dto.MediaCandidate
import org.slf4j.LoggerFactory
import org.springframework.core.annotation.Order
import org.springframework.http.ResponseEntity
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * DuckDuckGo 이미지 검색 우회 공급자.
 *
 * 별도 API 키 없이 동작하기 위해 다음 2단계 흐름으로 호출한다.
 *  1) `https://duckduckgo.com/?q=...` HTML 응답에서 일회성 토큰 `vqd` 및 세션 `Cookie` 수집
 *  2) `https://duckduckgo.com/i.js?...&vqd=...` 호출 시 획득한 Cookie와 헤더를 전파하여 이미지 JSON 수집
 *
 * 차단 우회를 위해 실제 브라우저와 유사한 User-Agent 헤더를 사용하며,
 * GIF 요청 시 `f=F,,,type:gif` 필터를 추가해 움짤만 우선 검색되도록 한다.
 *
 * [MediaSearchRouter]가 `strategies` 리스트의 첫 매치를 사용하므로,
 * 기본 이미지 검색 엔진으로 동작하도록 [Order] 값을 가장 낮게(=우선순위 높음) 지정한다.
 */
@Component
@Order(1)
class DuckDuckGoImageSearchProvider : MediaSearchService {

    private val log = LoggerFactory.getLogger(javaClass)

    // DDG 방화벽에서 단일 IP가 아주 찰나에 여러 HTTP 요청을 병렬로 던지는 것을 DDoS로 감지하고
    // Connection Reset / ClosedChannelException 을 내는 것을 방어하기 위한 세마포어/뮤텍스 락
    private val mutex = Mutex()

    // DDG가 봇 감지로 silent-drop 하는 경우 OS TCP 타임아웃(20~40s)까지 대기하지 않도록 명시적 컷오프.
    private val restClient = RestClient.builder()
        .defaultHeader("User-Agent", DEFAULT_USER_AGENT)
        .requestFactory(
            SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(3))
                setReadTimeout(Duration.ofSeconds(7))
            },
        )
        .build()

    override fun supports(mediaType: AiMediaType): Boolean =
        mediaType == AiMediaType.PHOTO || mediaType == AiMediaType.GIF

    override fun searchCandidates(keyword: String, mediaType: AiMediaType, maxResults: Int): List<MediaCandidate> = runBlocking {
        val preferGif = mediaType == AiMediaType.GIF
        val query = if (preferGif) "$keyword gif" else keyword

        log.info("Starting DuckDuckGo image search for keyword='{}' (preferGif={})", keyword, preferGif)
        
        mutex.withLock {
            try {
                // 이전 병렬 요청들과의 간격을 두어 DDG 봇 탐지 회피 (50ms)
                delay(50)

                val (vqd, cookies) = fetchVqdAndCookies(query)
                if (vqd.isNullOrBlank()) {
                    log.warn("Failed to extract vqd token from DuckDuckGo for keyword='{}'", keyword)
                    return@runBlocking emptyList()
                }
                log.info("Successfully obtained DuckDuckGo vqd token='{}' and {} cookies for keyword='{}'", vqd, cookies.size, keyword)
                
                val candidates = fetchImageCandidates(query, vqd, cookies, preferGif, maxResults)
                log.info("DuckDuckGo retrieved {} image candidates for keyword='{}'", candidates.size, keyword)
                candidates
            } catch (e: Exception) {
                log.error("DuckDuckGo image search failed for keyword='{}'", keyword, e)
                emptyList()
            }
        }
    }

    private fun fetchVqdAndCookies(query: String): Pair<String?, List<String>> {
        val responseEntity: ResponseEntity<String> = restClient.get()
            .uri { builder ->
                builder.scheme("https")
                    .host("duckduckgo.com")
                    .path("/")
                    .queryParam("q", query)
                    .build()
            }
            .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
            .header("Accept-Language", "ko,en-US;q=0.9,en;q=0.8")
            .retrieve()
            .toEntity(String::class.java)

        val html = responseEntity.body ?: return Pair(null, emptyList())
        val vqd = VQD_REGEX.find(html)?.groupValues?.get(1)
        val cookies = responseEntity.headers["Set-Cookie"] ?: emptyList()
        
        if (vqd == null) {
            log.debug("DuckDuckGo HTML payload sample for debug:\n{}", html.take(1000))
        }
        return Pair(vqd, cookies)
    }

    private fun fetchImageCandidates(
        query: String,
        vqd: String,
        cookies: List<String>,
        preferGif: Boolean,
        maxResults: Int,
    ): List<MediaCandidate> {
        val filter = if (preferGif) "F,,,type:gif" else ",,,"
        val encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8.name())

        val requestSpec = restClient.get()
            .uri { builder ->
                builder.scheme("https")
                    .host("duckduckgo.com")
                    .path("/i.js")
                    .queryParam("l", "us-en")
                    .queryParam("o", "json")
                    .queryParam("q", query)
                    .queryParam("vqd", vqd)
                    .queryParam("f", filter)
                    .queryParam("p", "1")
                    .queryParam("s", "0")
                    .build()
            }
            .header("Referer", "https://duckduckgo.com/?q=$encodedQuery")
            .header("Accept", "application/json, text/javascript, */*; q=0.01")
            .header("Accept-Language", "ko,en-US;q=0.9,en;q=0.8")
            .header("Sec-Fetch-Dest", "empty")
            .header("Sec-Fetch-Mode", "cors")
            .header("Sec-Fetch-Site", "same-origin")

        // 1차 요청 시점에 발급받은 세션 쿠키들을 헤더에 고스란히 담아 전송 (Stateful 전파)
        val finalRequestSpec = cookies.fold(requestSpec) { req, cookie ->
            val cookieValue = cookie.substringBefore(";")
            req.header("Cookie", cookieValue)
        }

        val response = finalRequestSpec.retrieve().body(Map::class.java)

        val results = response?.get("results") as? List<*> ?: return emptyList()
        return results.asSequence()
            .mapNotNull { item ->
                val row = item as? Map<*, *> ?: return@mapNotNull null
                val imageUrl = row["image"] as? String ?: return@mapNotNull null
                val rawTitle = row["title"] as? String
                val title = rawTitle?.trim()?.takeIf { it.isNotEmpty() }
                MediaCandidate(url = imageUrl, title = title)
            }
            .take(maxResults.coerceAtLeast(0))
            .toList()
    }

    companion object {
        private const val DEFAULT_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

        // vqd= 뒤에 & 나 작은따옴표('), 쌍따옴표("), 공백(\s) 직전까지를 안전하게 추출
        private val VQD_REGEX = Regex("""vqd=(?:"|&quot;)?([^&'"\s]+)""")
    }
}
