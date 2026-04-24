package com.pickty.server.global.oauth2

import jakarta.servlet.http.HttpServletRequest
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest
import org.springframework.stereotype.Component

/**
 * 로그인·/account 소셜 연동 공통: 브라우저에 남은 IdP 세션으로 묻지 않고 계정을 고르거나 다시 입력하도록
 * OAuth2 권한 부여 요청에 제공자별 파라미터를 항상 덧붙인다.
 *
 * - Google: [prompt=select_account](https://developers.google.com/identity/protocols/oauth2/openid-connect#authenticationuriparameters)
 * - Kakao: [prompt=login](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api#request-token)
 * - Naver: [auth_type=reprompt](https://developers.naver.com/docs/login/api/api.md)
 */
@Component
class PicktyOAuth2AuthorizationRequestResolver(
    clientRegistrationRepository: ClientRegistrationRepository,
) : OAuth2AuthorizationRequestResolver {

    private val defaultResolver = DefaultOAuth2AuthorizationRequestResolver(
        clientRegistrationRepository,
        AUTHORIZATION_REQUEST_BASE_URI,
    )

    override fun resolve(request: HttpServletRequest): OAuth2AuthorizationRequest? {
        val base = defaultResolver.resolve(request) ?: return null
        return addProviderHints(base)
    }

    override fun resolve(request: HttpServletRequest, clientRegistrationId: String): OAuth2AuthorizationRequest? {
        val base = defaultResolver.resolve(request, clientRegistrationId) ?: return null
        return addProviderHints(base)
    }

    private fun addProviderHints(base: OAuth2AuthorizationRequest): OAuth2AuthorizationRequest {
        val registrationIdAttr = "${ClientRegistration::class.java.name}.CLIENT_REGISTRATION_ID"
        val registrationId = base.getAttribute(registrationIdAttr) as? String ?: return base
        val merged = LinkedHashMap<String, Any>()
        merged.putAll(base.additionalParameters)
        when (registrationId) {
            "google" -> merged["prompt"] = "select_account"
            "kakao" -> merged["prompt"] = "login"
            "naver" -> merged["auth_type"] = "reprompt"
            else -> return base
        }
        return OAuth2AuthorizationRequest.from(base)
            .additionalParameters(merged)
            .build()
    }

    companion object {
        private const val AUTHORIZATION_REQUEST_BASE_URI = "/oauth2/authorization"
    }
}
