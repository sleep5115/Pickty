package com.pickty.server.domain.auth.dto

import com.pickty.server.domain.user.Provider

sealed class OAuth2UserInfo {
    abstract val provider: Provider
    abstract val providerId: String
    abstract val email: String?
    /** 소셜 측 실명·전체 이름 등 — `users.user_name` 저장용 (공개 API 에는 넣지 않음) */
    abstract val userName: String?
    /** 소셜 프로필 이미지 URL — `users.profile_image_url` 저장용 (공개 아바타와 별도) */
    abstract val profileImageUrl: String?

    companion object {
        fun of(registrationId: String, attributes: Map<String, Any>): OAuth2UserInfo =
            when (registrationId.lowercase()) {
                "google" -> Google(attributes)
                else -> throw IllegalArgumentException("지원하지 않는 OAuth2 Provider: $registrationId")
            }
    }

    data class Google(private val attributes: Map<String, Any>) : OAuth2UserInfo() {
        override val provider = Provider.GOOGLE
        override val providerId = attributes["sub"] as String
        override val email = attributes["email"] as? String
        override val userName = attributes["name"] as? String
        override val profileImageUrl = attributes["picture"] as? String
    }
}
