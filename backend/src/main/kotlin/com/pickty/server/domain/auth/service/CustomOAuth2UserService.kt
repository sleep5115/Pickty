package com.pickty.server.domain.auth.service

import com.pickty.server.domain.auth.PrincipalDetails
import com.pickty.server.domain.auth.dto.OAuth2UserInfo
import com.pickty.server.domain.user.AccountStatus
import com.pickty.server.domain.user.SocialAccount
import com.pickty.server.domain.user.SocialAccountRepository
import com.pickty.server.domain.user.User
import com.pickty.server.domain.user.UserRepository
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CustomOAuth2UserService(
    private val userRepository: UserRepository,
    private val socialAccountRepository: SocialAccountRepository,
) : DefaultOAuth2UserService() {

    @Transactional
    override fun loadUser(userRequest: OAuth2UserRequest): OAuth2User {
        val oAuth2User = super.loadUser(userRequest)
        val userInfo = OAuth2UserInfo.of(
            registrationId = userRequest.clientRegistration.registrationId,
            attributes = oAuth2User.attributes,
        )
        val attrs = oAuth2User.attributes.toSanitizedAttributeMap()
        val user = findOrCreateUser(userInfo, attrs)
        return PrincipalDetails(
            userId = user.id,
            email = user.email,
            attributes = oAuth2User.attributes,
        )
    }

    private fun findOrCreateUser(userInfo: OAuth2UserInfo, attrs: Map<String, Any?>): User {
        val existingSocialAccount = socialAccountRepository
            .findByProviderAndProviderId(userInfo.provider, userInfo.providerId)
            .orElse(null)

        if (existingSocialAccount != null) {
            existingSocialAccount.providerAttributes = attrs
            return existingSocialAccount.user
        }

        val emailUser = userInfo.email?.let { userRepository.findByEmail(it).orElse(null) }
        if (emailUser != null) {
            val socialAccount = SocialAccount(
                user = emailUser,
                provider = userInfo.provider,
                providerId = userInfo.providerId,
                providerAttributes = attrs,
            )
            emailUser.addSocialAccount(socialAccount)
            socialAccountRepository.save(socialAccount)
            emailUser.applyOAuthUserNameIfMissing(userInfo.userName)
            emailUser.applyOAuthProfileImageIfMissing(userInfo.profileImageUrl)
            return emailUser
        }

        // NOT NULL 닉네임: 저장 후 id 로 User_{id} 부여. 소셜 이미지는 profile_image_url 에만 (공개 아바타는 display_avatar_url).
        val user = userRepository.save(
            User(
                email = userInfo.email,
                password = null,
                nickname = PENDING_NICKNAME_PLACEHOLDER,
                profileImageUrl = userInfo.profileImageUrl,
                userName = userInfo.userName,
                accountStatus = AccountStatus.PENDING,
            ),
        )
        user.updateNickname("User_${user.id}")
        userRepository.save(user)

        val socialAccount = SocialAccount(
            user = user,
            provider = userInfo.provider,
            providerId = userInfo.providerId,
            providerAttributes = attrs,
        )
        user.addSocialAccount(socialAccount)
        socialAccountRepository.save(socialAccount)
        return user
    }

    /**
     * JSONB 저장용: String / Boolean / 정수·실수(Number) / 중첩 Map·List 만 허용.
     * 직렬화 불가·OAuth 전용 객체 등은 제외한다.
     */
    private fun Map<String, Any>.toSanitizedAttributeMap(): Map<String, Any?> {
        val out = LinkedHashMap<String, Any?>()
        for ((k, v) in this) {
            val key = k.toString()
            val sanitized = sanitizeOAuthAttributeValue(v)
            if (sanitized != null) {
                out[key] = sanitized
            }
        }
        return out
    }

    private fun sanitizeOAuthAttributeValue(value: Any?): Any? =
        when (value) {
            null -> null
            is String, is Boolean -> value
            is Int, is Long, is Short, is Byte -> value
            is Double, is Float -> value
            is Number -> {
                val d = value.toDouble()
                if (d % 1.0 == 0.0 && d >= Int.MIN_VALUE && d <= Int.MAX_VALUE) {
                    d.toInt()
                } else {
                    d
                }
            }
            is Map<*, *> -> {
                val inner = LinkedHashMap<String, Any?>()
                for ((rawK, rawV) in value) {
                    val ks = rawK?.toString() ?: continue
                    val el = sanitizeOAuthAttributeValue(rawV) ?: continue
                    inner[ks] = el
                }
                if (inner.isEmpty()) null else inner
            }
            is Iterable<*> -> {
                val list = value.mapNotNull { sanitizeOAuthAttributeValue(it) }
                if (list.isEmpty()) null else list
            }
            is Array<*> -> {
                val list = value.mapNotNull { sanitizeOAuthAttributeValue(it) }
                if (list.isEmpty()) null else list
            }
            else -> null
        }

    companion object {
        private const val PENDING_NICKNAME_PLACEHOLDER = "User_pending"
    }
}
