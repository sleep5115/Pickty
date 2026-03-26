package com.pickty.server.domain.auth.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

@Service
class OAuthExchangeService(
    private val redisTemplate: StringRedisTemplate,
) {
    companion object {
        private const val PREFIX = "oauth:exchange:"
        private val TTL = Duration.ofMinutes(2)
    }

    fun createForUser(userId: Long): String {
        val code = UUID.randomUUID().toString()
        redisTemplate.opsForValue().set("$PREFIX$code", userId.toString(), TTL)
        return code
    }

    fun consume(code: String): Long? {
        val key = "$PREFIX$code"
        val raw = redisTemplate.opsForValue().get(key) ?: return null
        redisTemplate.delete(key)
        return raw.toLongOrNull()
    }
}
