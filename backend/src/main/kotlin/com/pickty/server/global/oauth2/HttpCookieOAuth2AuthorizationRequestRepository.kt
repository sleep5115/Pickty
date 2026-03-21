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
        const val OAUTH2_FRONTEND_ORIGIN_COOKIE = "oauth2_frontend_origin"
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
            CookieUtils.deleteCookie(request, response, OAUTH2_FRONTEND_ORIGIN_COOKIE)
            return
        }
        CookieUtils.addCookie(
            response,
            OAUTH2_AUTHORIZATION_REQUEST_COOKIE,
            CookieUtils.serialize(authorizationRequest),
            COOKIE_EXPIRE_SECONDS,
        )
        // 로그인 시작 시점의 프론트엔드 오리진을 쿠키에 저장 → 성공 핸들러에서 동적 리다이렉트에 활용
        val origin = request.getHeader("Origin") ?: request.getHeader("Referer")
            ?.let { runCatching { java.net.URI(it).let { u -> "${u.scheme}://${u.host}${if (u.port > 0) ":${u.port}" else ""}" } }.getOrNull() }
        if (origin != null) {
            CookieUtils.addCookie(response, OAUTH2_FRONTEND_ORIGIN_COOKIE, origin, COOKIE_EXPIRE_SECONDS)
        }
    }

    override fun removeAuthorizationRequest(
        request: HttpServletRequest,
        response: HttpServletResponse,
    ): OAuth2AuthorizationRequest? =
        loadAuthorizationRequest(request).also {
            CookieUtils.deleteCookie(request, response, OAUTH2_AUTHORIZATION_REQUEST_COOKIE)
            CookieUtils.deleteCookie(request, response, OAUTH2_FRONTEND_ORIGIN_COOKIE)
        }
}
