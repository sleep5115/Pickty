package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

/**
 * SSE 연결 인증용 단기 일회용 티켓.
 * - 발급: hostToken 검증된 방장에게 10초 TTL UUID 발급
 * - 소비: SSE 연결 직전 GETDEL(Lua) — 1회용
 */
@Service
class StreamerSseTicketService(
    private val redisTemplate: StringRedisTemplate,
    private val streamerTicketConsumeScript: DefaultRedisScript<String>,
) {

    fun issue(sessionId: UUID, hostToken: String): UUID {
        val ticketId = UUID.randomUUID()
        val key = StreamerValkeyKeys.sseTicket(ticketId)
        val payload = "$sessionId:$hostToken"
        redisTemplate.opsForValue().set(key, payload, Duration.ofSeconds(TTL_SECONDS))
        return ticketId
    }

    /**
     * @return 발급 시점의 (sessionId, hostToken) 쌍. 유효하지 않으면 null.
     */
    fun consume(ticketId: UUID): Pair<UUID, String>? {
        val key = StreamerValkeyKeys.sseTicket(ticketId)
        val raw = redisTemplate.execute(streamerTicketConsumeScript, listOf(key)) ?: return null
        val sep = raw.indexOf(':')
        if (sep <= 0 || sep == raw.length - 1) return null
        val sessionId = runCatching { UUID.fromString(raw.substring(0, sep)) }.getOrNull() ?: return null
        val hostToken = raw.substring(sep + 1)
        return sessionId to hostToken
    }

    companion object {
        const val TTL_SECONDS = 10L
    }
}
