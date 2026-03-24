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
                "kakao" -> Kakao(attributes)
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

    /** https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#req-user-info */
    data class Kakao(private val attributes: Map<String, Any>) : OAuth2UserInfo() {
        override val provider = Provider.KAKAO
        override val providerId = (attributes["id"] as Number).toString()
        override val email = kakaoAccountString("email")
        override val userName = profileString("nickname")
        override val profileImageUrl = profileString("profile_image_url")

        private fun kakaoAccount(): Map<*, *>? = attributes["kakao_account"] as? Map<*, *>

        private fun kakaoAccountString(key: String): String? {
            val v = kakaoAccount()?.get(key) ?: return null
            return v.toString().trim().takeIf { it.isNotEmpty() }
        }

        private fun profileString(key: String): String? {
            val profile = kakaoAccount()?.get("profile") as? Map<*, *> ?: return null
            val v = profile[key] ?: return null
            return v.toString().trim().takeIf { it.isNotEmpty() }
        }
    }
}
