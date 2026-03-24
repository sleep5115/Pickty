package com.pickty.server.domain.user

import com.pickty.server.domain.user.dto.CompleteOnboardingRequest
import com.pickty.server.domain.user.dto.UpdateProfileRequest
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.Year

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
        // 공개 아바타는 업로드 전용 컬럼만 (소셜 `profile_image_url` 과 분리)
        val publicAvatar = user.displayAvatarUrl?.takeIf { it.isNotBlank() }
        return UserResponse(
            id = user.id,
            nickname = user.nickname,
            profileImageUrl = publicAvatar,
            role = user.role.name,
            providers = providers,
            createdAt = user.createdAt.toString(),
            accountStatus = user.accountStatus.name,
            gender = user.gender?.name,
            birthYear = user.birthYear,
        )
    }

    fun getSensitiveProfile(userId: Long): UserSensitiveProfileResponse {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        val accounts = socialAccountRepository.findAllByUser_Id(userId)
        val singleAccount = accounts.size == 1
        val linked = accounts.map { acc ->
            val attrs = acc.providerAttributes ?: emptyMap()
            SensitiveLinkedAccountDto(
                provider = acc.provider.name,
                email = oauthAttrString(attrs, "email") ?: user.email?.takeIf { singleAccount },
                name = oauthAttrString(attrs, "name") ?: user.userName?.takeIf { singleAccount },
                profileImageUrl = oauthAttrString(attrs, "picture")
                    ?: user.profileImageUrl?.takeIf { singleAccount },
            )
        }
        return UserSensitiveProfileResponse(linkedAccounts = linked)
    }

    /** JSONB 맵에서 OAuth 문자열 속성 추출 (null·빈 문자열 제외) */
    private fun oauthAttrString(attrs: Map<String, Any?>, key: String): String? {
        val v = attrs[key] ?: return null
        val s = v as? String ?: return null
        return s.trim().takeIf { it.isNotEmpty() }
    }

    @Transactional
    fun completeOnboarding(userId: Long, request: CompleteOnboardingRequest) {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        if (user.accountStatus != AccountStatus.PENDING) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "이미 온보딩을 완료한 계정입니다.")
        }
        request.birthYear?.let { y ->
            val now = Year.now().value
            if (y !in 1900..now) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "생년이 올바르지 않습니다.")
            }
        }
        user.completeOnboarding(
            nickname = request.nickname.trim(),
            displayAvatarUrl = request.displayAvatarUrl?.trim()?.takeIf { it.isNotEmpty() },
            gender = request.gender,
            birthYear = request.birthYear,
        )
    }

    @Transactional
    fun updateProfile(userId: Long, request: UpdateProfileRequest) {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        if (user.accountStatus != AccountStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "활성 계정만 프로필을 수정할 수 있습니다.")
        }
        request.birthYear?.let { y ->
            val now = Year.now().value
            if (y !in 1900..now) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "생년이 올바르지 않습니다.")
            }
        }
        user.updatePublicProfile(
            nickname = request.nickname.trim(),
            displayAvatarUrl = request.displayAvatarUrl?.trim()?.takeIf { it.isNotEmpty() },
            gender = request.gender,
            birthYear = request.birthYear,
        )
    }

    fun getOAuthRaw(userId: Long): Map<String, Any?>? {
        val json = redisTemplate.opsForValue().get("oauth2:raw:$userId") ?: return null
        return objectMapper.readValue(json, object : TypeReference<Map<String, Any?>>() {})
    }
}
