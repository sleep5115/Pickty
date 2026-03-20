package com.pickty.server.domain.user

import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service

@Service
class UserService(
    private val userRepository: UserRepository,
    private val socialAccountRepository: SocialAccountRepository,
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
) {
    fun getMe(userId: Long): UserResponse {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        val providers = socialAccountRepository.findAllByUser_Id(userId)
            .map { it.provider.name }
        return UserResponse(
            id = user.id,
            email = user.email,
            nickname = user.nickname,
            profileImageUrl = user.profileImageUrl,
            role = user.role.name,
            providers = providers,
            createdAt = user.createdAt.toString(),
        )
    }

    fun getOAuthRaw(userId: Long): Map<String, Any?>? {
        val json = redisTemplate.opsForValue().get("oauth2:raw:$userId") ?: return null
        return objectMapper.readValue(json, object : TypeReference<Map<String, Any?>>() {})
    }
}
