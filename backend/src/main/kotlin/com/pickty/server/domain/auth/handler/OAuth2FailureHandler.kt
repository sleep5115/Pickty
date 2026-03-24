package com.pickty.server.domain.auth.handler

import com.pickty.server.global.oauth2.CookieUtils
import com.pickty.server.global.oauth2.HttpCookieOAuth2AuthorizationRequestRepository
import com.pickty.server.global.oauth2.OAuthLinkConstants
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder

@Component
class OAuth2FailureHandler(
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
    @Value("\${app.frontend-url:https://pickty.app}") private val frontendUrl: String,
    @Value("\${app.oauth2.allowed-frontend-origins:https://pickty.app,https://www.pickty.app,http://localhost:3002,http://127.0.0.1:3002}") private val allowedOriginsRaw: String,
) : SimpleUrlAuthenticationFailureHandler() {

    private val allowedOrigins: Set<String> by lazy {
        allowedOriginsRaw.split(",").map { it.trim() }.toSet()
    }

    override fun onAuthenticationFailure(
        request: HttpServletRequest,
        response: HttpServletResponse,
        exception: AuthenticationException,
    ) {
        CookieUtils.deleteCookie(request, response, OAuthLinkConstants.OAUTH_LINK_COOKIE)

        val savedOrigin = CookieUtils.getCookie(request, HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_FRONTEND_ORIGIN_COOKIE)?.value
        val resolvedOrigin = savedOrigin?.takeIf { it in allowedOrigins } ?: frontendUrl

        val targetUrl = UriComponentsBuilder
            .fromUriString("$resolvedOrigin/auth/callback")
            .queryParam("error", "oauth_failed")
            .build()
            .toUriString()

        cookieAuthorizationRequestRepository.removeAuthorizationRequest(request, response)

        redirectStrategy.sendRedirect(request, response, targetUrl)
    }
}
