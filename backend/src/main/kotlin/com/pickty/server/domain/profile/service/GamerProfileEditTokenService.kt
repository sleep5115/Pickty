package com.pickty.server.domain.profile.service

import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Duration
import java.util.UUID

/**
 * 비회원 프로필 편집용 임시 토큰을 Valkey 에 발행/검증한다.
 * 암구호 검증(`verify-password`)에 성공하면 1시간 만료 토큰을 발급하고,
 * 이후 수정/삭제/인증샷 업로드 요청은 `X-Profile-Edit-Token` 헤더로 이 토큰을 증명한다.
 */
@Service
class GamerProfileEditTokenService(
    private val stringRedisTemplate: StringRedisTemplate,
) {
    fun issue(slug: String): IssuedToken {
        val token = UUID.randomUUID().toString().replace("-", "")
        stringRedisTemplate.opsForValue().set(keyFor(slug), token, TOKEN_TTL)
        return IssuedToken(token, TOKEN_TTL.seconds)
    }

    fun isValid(slug: String, token: String?): Boolean {
        if (token.isNullOrBlank()) return false
        val stored = stringRedisTemplate.opsForValue().get(keyFor(slug)) ?: return false
        return stored == token
    }

    private fun keyFor(slug: String): String = "$KEY_PREFIX:$slug"

    data class IssuedToken(val token: String, val expiresInSeconds: Long)

    companion object {
        private const val KEY_PREFIX = "gamer:profile:edit-token"
        private val TOKEN_TTL: Duration = Duration.ofHours(1)
    }
}
