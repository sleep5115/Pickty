package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * HyperLogLog 분 단위 슬라이딩 윈도우 동접자 카운터.
 * - 시청자 폴링 1건당 현재 분 키에 visitor 해시를 PFADD
 * - 동접 산정은 최근 2분 키 합산(PFCOUNT k1 k2)으로 union cardinality 직접 산출
 * - 분당 키는 TTL 3분으로 자동 소거되어 메모리 누수 없음
 *
 * 1 Lua 호출 = 1 RTT로 PFADD + EXPIRE + PFCOUNT 까지 끝낸다.
 */
@Service
class StreamerActiveUserCounter(
    private val redisTemplate: StringRedisTemplate,
    private val streamerActiveTouchScript: DefaultRedisScript<Long>,
) {

    fun touchAndCount(sessionId: UUID, visitorKey: String, nowEpochSeconds: Long = Instant.now().epochSecond): Long {
        val instant = Instant.ofEpochSecond(nowEpochSeconds)
        val currentToken = MINUTE_FORMATTER.format(instant)
        val prevToken = MINUTE_FORMATTER.format(instant.minusSeconds(60))
        val keys = listOf(
            StreamerValkeyKeys.activeUsersMinute(sessionId, currentToken),
            StreamerValkeyKeys.activeUsersMinute(sessionId, prevToken),
        )
        return redisTemplate.execute(
            streamerActiveTouchScript,
            keys,
            visitorKey,
            BUCKET_TTL_SECONDS.toString(),
        ) ?: 0L
    }

    companion object {
        const val BUCKET_TTL_SECONDS = 180L
        private val MINUTE_FORMATTER: DateTimeFormatter =
            DateTimeFormatter.ofPattern("yyyyMMddHHmm").withZone(ZoneOffset.UTC)
    }
}
