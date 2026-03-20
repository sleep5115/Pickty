package com.pickty.server.domain.auth.handler

import com.pickty.server.domain.auth.PrincipalDetails
import com.pickty.server.domain.auth.service.RefreshTokenService
import com.pickty.server.global.jwt.JwtTokenProvider
import com.pickty.server.global.oauth2.HttpCookieOAuth2AuthorizationRequestRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder

@Component
class OAuth2SuccessHandler(
    private val jwtTokenProvider: JwtTokenProvider,
    private val refreshTokenService: RefreshTokenService,
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
    @Value("\${app.frontend-url:http://localhost:3002}") private val frontendUrl: String,
) : SimpleUrlAuthenticationSuccessHandler() {

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication,
    ) {
        val principal = authentication.principal as PrincipalDetails

        val accessToken = jwtTokenProvider.generateAccessToken(principal.userId, principal.email)
        val refreshToken = jwtTokenProvider.generateRefreshToken()
        refreshTokenService.save(principal.userId, refreshToken)

        clearAuthenticationAttributes(request, response)

        // TODO: 운영 환경에서는 refreshToken을 HttpOnly 쿠키로 전달하도록 변경
        val targetUrl = UriComponentsBuilder
            .fromUriString("$frontendUrl/auth/callback")
            .queryParam("accessToken", accessToken)
            .build().toUriString()

        redirectStrategy.sendRedirect(request, response, targetUrl)
    }

    private fun clearAuthenticationAttributes(request: HttpServletRequest, response: HttpServletResponse) {
        super.clearAuthenticationAttributes(request)
        cookieAuthorizationRequestRepository.removeAuthorizationRequest(request, response)
    }
}
