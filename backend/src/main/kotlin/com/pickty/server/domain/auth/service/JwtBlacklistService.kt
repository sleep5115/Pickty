package com.pickty.server.domain.auth.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.security.MessageDigest
import java.time.Duration

@Service
class JwtBlacklistService(
    private val redisTemplate: StringRedisTemplate,
) {
    companion object {
        private const val PREFIX = "jwt:blacklist:"
    }

    fun add(token: String, ttlSeconds: Long) {
        if (ttlSeconds <= 0L) return
        redisTemplate.opsForValue().set(keyFor(token), "1", Duration.ofSeconds(ttlSeconds))
    }

    fun isBlacklisted(token: String): Boolean =
        redisTemplate.hasKey(keyFor(token)) == true

    private fun keyFor(token: String): String =
        PREFIX + MessageDigest.getInstance("SHA-256")
            .digest(token.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
}
