package com.pickty.server.global.oauth2

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

@Service
class OAuthLinkService(
    private val redisTemplate: StringRedisTemplate,
) {

    fun createChallenge(userId: Long): String {
        val token = UUID.randomUUID().toString()
        val key = "${OAuthLinkConstants.REDIS_KEY_PREFIX}$token"
        redisTemplate.opsForValue().set(key, userId.toString(), Duration.ofSeconds(OAuthLinkConstants.REDIS_TTL_SECONDS))
        return token
    }

    /** 소비(1회용). 실패 시 null */
    fun consumeChallenge(token: String): Long? {
        val key = "${OAuthLinkConstants.REDIS_KEY_PREFIX}$token"
        val v = redisTemplate.opsForValue().get(key) ?: return null
        redisTemplate.delete(key)
        return v.toLongOrNull()
    }
}
