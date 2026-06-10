package com.pickty.server.domain.profile.service

import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * 비회원도 열려 있는 프로필 엔드포인트의 가벼운 어뷰징 방어벽(Valkey).
 * - AI 자연어 카드 생성: IP 기준 하루 5회 (초과 시 429 → 프론트가 수동 폼으로 안내)
 * - 프로필 이미지 업로드: IP 기준 시간당 40회 (도배 차단)
 *
 * Valkey 장애 시에는 사용자 흐름을 막지 않도록 통과시킨다(가용성 우선).
 */
@Service
class GamerProfileRateLimiter(
    private val stringRedisTemplate: StringRedisTemplate,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** 하루 5회 초과 시 429. 메시지는 프론트가 가로채 수동 폼으로 폴백. */
    fun checkAiGenerate(ipHash: String) {
        val key = "$AI_KEY_PREFIX:$ipHash:${todayKst()}"
        if (incrementAndExceeded(key, AI_DAILY_LIMIT, Duration.ofDays(1))) {
            throw ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "일일 AI 생성 한도(${AI_DAILY_LIMIT}회)를 모두 소진했습니다.",
            )
        }
    }

    /** 시간당 40회 초과 시 429. */
    fun checkImageUpload(ipHash: String) {
        val key = "$IMG_KEY_PREFIX:$ipHash:${thisHourKst()}"
        if (incrementAndExceeded(key, IMG_HOURLY_LIMIT, Duration.ofHours(1))) {
            throw ResponseStatusException(
                HttpStatus.TOO_MANY_REQUESTS,
                "이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            )
        }
    }

    /** key 를 1 증가시키고 limit 초과 여부를 반환. 첫 증가 시 TTL 설정. */
    private fun incrementAndExceeded(key: String, limit: Long, ttl: Duration): Boolean {
        return try {
            val n = stringRedisTemplate.opsForValue().increment(key) ?: return false
            if (n == 1L) {
                stringRedisTemplate.expire(key, ttl)
            }
            n > limit
        } catch (e: Exception) {
            log.warn("GamerProfile rate-limit Valkey INCR failed for key={} — passing through", key, e)
            false
        }
    }

    private fun todayKst(): String = LocalDate.now(KST).toString()

    private fun thisHourKst(): String = LocalDateTime.now(KST).format(HOUR_FORMAT)

    companion object {
        private val KST: ZoneId = ZoneId.of("Asia/Seoul")
        private val HOUR_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMddHH")
        private const val AI_KEY_PREFIX = "gamer:profile:ai-limit"
        private const val IMG_KEY_PREFIX = "gamer:profile:img-limit"
        private const val AI_DAILY_LIMIT = 5L
        private const val IMG_HOURLY_LIMIT = 40L
    }
}
