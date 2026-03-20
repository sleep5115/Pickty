package com.pickty.server.domain.auth.dto

import com.pickty.server.domain.user.Provider

sealed class OAuth2UserInfo {
    abstract val provider: Provider
    abstract val providerId: String
    abstract val email: String?
    abstract val nickname: String
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
        override val nickname = (attributes["name"] as? String) ?: "알 수 없음"
        override val profileImageUrl = attributes["picture"] as? String
    }
}
