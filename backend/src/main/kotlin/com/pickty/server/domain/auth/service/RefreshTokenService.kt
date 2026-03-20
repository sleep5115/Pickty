package com.pickty.server.domain.auth.service

import com.pickty.server.global.jwt.JwtProperties
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration

@Service
class RefreshTokenService(
    private val redisTemplate: StringRedisTemplate,
    private val jwtProperties: JwtProperties,
) {
    companion object {
        private const val KEY_PREFIX = "refresh:"
    }

    fun save(userId: Long, refreshToken: String) {
        redisTemplate.opsForValue().set(
            "$KEY_PREFIX$userId",
            refreshToken,
            Duration.ofSeconds(jwtProperties.refreshTokenExpirationSeconds),
        )
    }

    fun get(userId: Long): String? =
        redisTemplate.opsForValue().get("$KEY_PREFIX$userId")

    fun delete(userId: Long) {
        redisTemplate.delete("$KEY_PREFIX$userId")
    }

    fun isValid(userId: Long, refreshToken: String): Boolean =
        get(userId) == refreshToken
}
