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
        private const val USER_PREFIX = "refresh:user:"
        private const val TOKEN_PREFIX = "refresh:token:"
    }

    private fun ttl(): Duration =
        Duration.ofSeconds(jwtProperties.refreshTokenExpirationSeconds)

    fun save(userId: Long, refreshToken: String) {
        get(userId)?.let { old -> deleteKeys(userId, old) }
        val ttl = ttl()
        redisTemplate.opsForValue().set("$USER_PREFIX$userId", refreshToken, ttl)
        redisTemplate.opsForValue().set("$TOKEN_PREFIX$refreshToken", userId.toString(), ttl)
    }

    fun get(userId: Long): String? =
        redisTemplate.opsForValue().get("$USER_PREFIX$userId")

    fun resolveUserIdByRefreshToken(refreshToken: String): Long? =
        redisTemplate.opsForValue().get("$TOKEN_PREFIX$refreshToken")?.toLongOrNull()

    fun delete(userId: Long) {
        get(userId)?.let { deleteKeys(userId, it) }
    }

    fun deleteByRefreshToken(refreshToken: String) {
        val userId = resolveUserIdByRefreshToken(refreshToken) ?: return
        deleteKeys(userId, refreshToken)
    }

    fun isValid(userId: Long, refreshToken: String): Boolean =
        get(userId) == refreshToken

    private fun deleteKeys(userId: Long, refreshToken: String) {
        redisTemplate.delete("$USER_PREFIX$userId")
        redisTemplate.delete("$TOKEN_PREFIX$refreshToken")
    }
}
