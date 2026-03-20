package com.pickty.server.global.oauth2

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest
import org.springframework.stereotype.Component

/**
 * OAuth2 인증 요청 상태를 세션 대신 쿠키에 저장한다.
 * SessionCreationPolicy.STATELESS와 OAuth2 로그인을 함께 사용하기 위해 필요하다.
 */
@Component
class HttpCookieOAuth2AuthorizationRequestRepository :
    AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    companion object {
        const val OAUTH2_AUTHORIZATION_REQUEST_COOKIE = "oauth2_auth_request"
        private const val COOKIE_EXPIRE_SECONDS = 180
    }

    override fun loadAuthorizationRequest(request: HttpServletRequest): OAuth2AuthorizationRequest? =
        CookieUtils.getCookie(request, OAUTH2_AUTHORIZATION_REQUEST_COOKIE)
            ?.let { CookieUtils.deserialize(it, OAuth2AuthorizationRequest::class.java) }

    override fun saveAuthorizationRequest(
        authorizationRequest: OAuth2AuthorizationRequest?,
        request: HttpServletRequest,
        response: HttpServletResponse,
    ) {
        if (authorizationRequest == null) {
            CookieUtils.deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE)
            return
        }
        CookieUtils.addCookie(
            response,
            OAUTH2_AUTHORIZATION_REQUEST_COOKIE,
            CookieUtils.serialize(authorizationRequest),
            COOKIE_EXPIRE_SECONDS,
        )
    }

    override fun removeAuthorizationRequest(
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): OAuth2AuthorizationRequest? =
        loadAuthorizationRequest(request).also {
            CookieUtils.deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE)
        }
}
