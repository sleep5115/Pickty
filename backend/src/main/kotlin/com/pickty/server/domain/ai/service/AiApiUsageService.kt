package com.pickty.server.domain.ai.service

import com.pickty.server.domain.ai.dto.AiAdminUsageResponse
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

/**
 * Google Custom Search·YouTube Data API 등 일일 쿼터가 **미국 태평양(PT) 자정**에 리셋되는 서비스와
 * 날짜 키를 맞추기 위해 [PT_ZONE] 기준 `yyyy-MM-dd`로 Valkey 키를 만든다.
 */
@Service
class AiApiUsageService(
    private val stringRedisTemplate: StringRedisTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    enum class TrackedApi(val keySegment: String) {
        GEMINI("gemini"),
        YOUTUBE("youtube"),
        GOOGLE_SEARCH("google_search"),
    }

    fun recordGeminiGenerateContentCall() = increment(TrackedApi.GEMINI)

    fun recordYouTubeSearchCall() = increment(TrackedApi.YOUTUBE)

    fun recordGoogleCustomSearchCall() = increment(TrackedApi.GOOGLE_SEARCH)

    fun getTodayUsagePt(): AiAdminUsageResponse {
        val date = todayPtString()
        val gm = readCount(keyFor(TrackedApi.GEMINI, date))
        val yt = readCount(keyFor(TrackedApi.YOUTUBE, date))
        val gs = readCount(keyFor(TrackedApi.GOOGLE_SEARCH, date))
        return AiAdminUsageResponse(gemini = gm, youtube = yt, googleSearch = gs)
    }

    private fun increment(api: TrackedApi) {
        try {
            val key = keyFor(api, todayPtString())
            val n = stringRedisTemplate.opsForValue().increment(key) ?: return
            if (n == 1L) {
                stringRedisTemplate.expire(key, KEY_TTL)
            }
        } catch (e: Exception) {
            log.warn("AiApiUsage Valkey INCR failed for {}", api, e)
        }
    }

    private fun readCount(key: String): Long =
        try {
            stringRedisTemplate.opsForValue().get(key)?.toLongOrNull() ?: 0L
        } catch (e: Exception) {
            log.warn("AiApiUsage Valkey GET failed for key={}", key, e)
            0L
        }

    private fun keyFor(api: TrackedApi, datePt: String): String =
        "$KEY_PREFIX:${api.keySegment}:$datePt"

    private fun todayPtString(): String = LocalDate.now(PT_ZONE).toString()

    companion object {
        val PT_ZONE: ZoneId = ZoneId.of("America/Los_Angeles")
        private const val KEY_PREFIX = "ai_api_usage"
        private val KEY_TTL: Duration = Duration.ofDays(4)
    }
}
