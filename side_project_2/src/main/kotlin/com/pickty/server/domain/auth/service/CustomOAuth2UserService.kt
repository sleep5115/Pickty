package com.pickty.server.domain.auth.service

import com.pickty.server.domain.auth.PrincipalDetails
import com.pickty.server.domain.auth.dto.OAuth2UserInfo
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
        val user = findOrCreateUser(userInfo)
        return PrincipalDetails(
            userId = user.id,
            email = user.email,
            attributes = oAuth2User.attributes,
        )
    }

    private fun findOrCreateUser(userInfo: OAuth2UserInfo): User {
        val existingSocialAccount = socialAccountRepository
            .findByProviderAndProviderId(userInfo.provider, userInfo.providerId)
            .orElse(null)

        if (existingSocialAccount != null) {
            return existingSocialAccount.user
        }

        // 같은 이메일 유저가 있으면 소셜 계정만 연결, 없으면 신규 생성
        val user = userInfo.email
            ?.let { userRepository.findByEmail(it).orElse(null) }
            ?: userRepository.save(
                User(
                    email = userInfo.email,
                    password = null,
                    nickname = userInfo.nickname,
                    profileImageUrl = userInfo.profileImageUrl,
                ),
            )

        val socialAccount = SocialAccount(
            user = user,
            provider = userInfo.provider,
            providerId = userInfo.providerId,
        )
        user.addSocialAccount(socialAccount)
        socialAccountRepository.save(socialAccount)
        return user
    }
}
