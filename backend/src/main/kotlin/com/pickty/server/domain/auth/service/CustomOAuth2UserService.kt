package com.pickty.server.domain.auth.service

import com.pickty.server.domain.auth.security.PrincipalDetails
import com.pickty.server.domain.auth.dto.OAuth2UserInfo
import com.pickty.server.domain.user.service.AccountMergeService
import com.pickty.server.domain.user.enums.AccountStatus
import com.pickty.server.domain.user.entity.SocialAccount
import com.pickty.server.domain.user.repository.SocialAccountRepository
import com.pickty.server.domain.user.entity.User
import com.pickty.server.domain.user.repository.UserRepository
import com.pickty.server.global.oauth2.CookieUtils
import com.pickty.server.global.oauth2.OAuthLinkConstants
import jakarta.servlet.http.HttpServletRequest
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.context.request.RequestContextHolder
import org.springframework.web.context.request.ServletRequestAttributes

@Service
class CustomOAuth2UserService(
    private val userRepository: UserRepository,
    private val socialAccountRepository: SocialAccountRepository,
    private val accountMergeService: AccountMergeService,
) : DefaultOAuth2UserService() {

    @Transactional
    override fun loadUser(userRequest: OAuth2UserRequest): OAuth2User {
        val oAuth2User = super.loadUser(userRequest)
        val registrationId = userRequest.clientRegistration.registrationId
        val userInfo = OAuth2UserInfo.of(
            registrationId = registrationId,
            attributes = oAuth2User.attributes,
        )
        val attrs = oAuth2User.attributes.toSanitizedAttributeMap()
        val user = findOrCreateUser(userInfo, attrs, registrationId)
        return PrincipalDetails(
            userId = user.id,
            email = user.email,
            attributes = oAuth2User.attributes,
        )
    }

    private fun findOrCreateUser(
        userInfo: OAuth2UserInfo,
        attrs: Map<String, Any?>,
        registrationId: String,
    ): User {
        val linkCtx = readOAuthLinkContext(registrationId)

        val existingSocialAccount = socialAccountRepository
            .findByProviderAndProviderId(userInfo.provider, userInfo.providerId)
            .orElse(null)

        if (linkCtx != null) {
            return resolveOAuthLinkMode(userInfo, attrs, existingSocialAccount, linkCtx)
        }

        if (existingSocialAccount != null) {
            val u = existingSocialAccount.user
            if (u.accountStatus == AccountStatus.MERGED || u.accountStatus == AccountStatus.DELETED) {
                oauth2Fail("invalid_user", "사용할 수 없는 계정입니다.")
            }
            existingSocialAccount.providerAttributes = attrs
            return u
        }

        val emailUser = userInfo.email?.let { userRepository.findByEmail(it).orElse(null) }
        if (emailUser != null) {
            if (emailUser.accountStatus == AccountStatus.MERGED || emailUser.accountStatus == AccountStatus.DELETED) {
                oauth2Fail("invalid_user", "이 이메일은 사용할 수 없습니다.")
            }
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

        val user = userRepository.save(
            User(
                email = userInfo.email,
                nickname = PENDING_NICKNAME_PLACEHOLDER,
                profileImageUrl = userInfo.profileImageUrl,
                userName = userInfo.userName,
                accountStatus = AccountStatus.PENDING,
            ),
        )
        user.updateNickname(buildDefaultPlayfulNickname())
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

    private data class OAuthLinkContext(val userId: Long)

    private fun currentRequest(): HttpServletRequest? =
        (RequestContextHolder.getRequestAttributes() as? ServletRequestAttributes)?.request

    private fun readOAuthLinkContext(registrationId: String): OAuthLinkContext? {
        val raw = currentRequest()
            ?.let { CookieUtils.getCookie(it, OAuthLinkConstants.OAUTH_LINK_COOKIE) }
            ?.value
            ?: return null
        val parts = raw.split("|", limit = 3)
        if (parts.size != 2) return null
        val userId = parts[0].toLongOrNull() ?: return null
        if (parts[1] != registrationId.lowercase()) return null
        return OAuthLinkContext(userId)
    }

    private fun resolveOAuthLinkMode(
        userInfo: OAuth2UserInfo,
        attrs: Map<String, Any?>,
        existingSocial: SocialAccount?,
        ctx: OAuthLinkContext,
    ): User {
        val initiator = userRepository.findById(ctx.userId)
            .orElseThrow { OAuth2AuthenticationException(OAuth2Error("invalid_request", "연동 요청이 올바르지 않습니다.", null)) }

        if (initiator.accountStatus != AccountStatus.ACTIVE) {
            oauth2Fail("invalid_request", "활성 계정만 소셜 연동을 진행할 수 있습니다.")
        }

        if (existingSocial != null) {
            val oauthUser = existingSocial.user
            if (oauthUser.accountStatus == AccountStatus.MERGED || oauthUser.accountStatus == AccountStatus.DELETED) {
                oauth2Fail("invalid_user", "연동할 수 없는 소셜 계정입니다.")
            }
            if (oauthUser.id == initiator.id) {
                existingSocial.providerAttributes = attrs
                socialAccountRepository.save(existingSocial)
                return initiator
            }
            val survivorId = accountMergeService.mergeAccount(initiator.id, oauthUser.id)
            val survivor = userRepository.findById(survivorId)
                .orElseThrow { IllegalStateException("merge survivor not found") }
            val sa = socialAccountRepository.findByProviderAndProviderId(userInfo.provider, userInfo.providerId)
                .orElseThrow()
            sa.providerAttributes = attrs
            socialAccountRepository.save(sa)
            return survivor
        }

        val socialAccount = SocialAccount(
            user = initiator,
            provider = userInfo.provider,
            providerId = userInfo.providerId,
            providerAttributes = attrs,
        )
        initiator.addSocialAccount(socialAccount)
        socialAccountRepository.save(socialAccount)
        initiator.applyOAuthUserNameIfMissing(userInfo.userName)
        initiator.applyOAuthProfileImageIfMissing(userInfo.profileImageUrl)
        return initiator
    }

    private fun oauth2Fail(code: String, desc: String): Nothing =
        throw OAuth2AuthenticationException(OAuth2Error(code, desc, null))

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

    private fun buildDefaultPlayfulNickname(): String {
        val adj = PLAYFUL_ADJECTIVES.random()
        val noun = PLAYFUL_NOUNS.random()
        return "$adj$noun"
    }

    companion object {
        private const val PENDING_NICKNAME_PLACEHOLDER = "User_pending"

        private val PLAYFUL_ADJECTIVES = listOf(
            "무시무시한",
            "수상한",
            "말랑한",
            "배고픈",
            "용감한",
            "촉촉한",
            "포근한",
            "힙한",
            "은밀한",
            "즐거운",
        )

        private val PLAYFUL_NOUNS = listOf(
            "바지",
            "오징어",
            "젤리",
            "거북이",
            "푸딩",
            "다람쥐",
            "고양이",
            "감자",
            "찌개",
            "도토리",
        )
    }
}
