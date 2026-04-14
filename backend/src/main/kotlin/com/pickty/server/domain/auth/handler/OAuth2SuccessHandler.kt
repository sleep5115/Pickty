package com.pickty.server.domain.auth.handler

import tools.jackson.databind.ObjectMapper
import com.pickty.server.domain.auth.security.PrincipalDetails
import com.pickty.server.domain.auth.service.OAuthExchangeService
import com.pickty.server.domain.auth.service.RefreshTokenService
import com.pickty.server.global.jwt.JwtTokenProvider
import com.pickty.server.global.jwt.RefreshTokenCookieWriter
import com.pickty.server.global.oauth2.CookieUtils
import com.pickty.server.global.oauth2.HttpCookieOAuth2AuthorizationRequestRepository
import com.pickty.server.global.oauth2.OAuthLinkConstants
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.security.core.Authentication
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler
import org.springframework.stereotype.Component
import org.springframework.web.util.UriComponentsBuilder
import java.time.Duration

/**
 * 로그인 성공 후 Refresh 는 HttpOnly+Secure 쿠키, Access 는 1회용 exchange 코드로
 * [resolvedOrigin]/auth/callback?exchange=... 리다이렉트 후 `POST /api/v1/auth/oauth-exchange` 로 수령.
 * resolvedOrigin 은 OAuth 시작 시 쿠키에 저장된 Origin(화이트리스트) 또는 [FRONTEND_URL].
 *
 * --- Google Cloud Console (웹 클라이언트)에 복사용 ---
 * 「승인된 리디렉션 URI」(Authorized redirect URIs), 정확히 한 줄씩:
 *   https://api.pickty.app/login/oauth2/code/google
 *   http://localhost:8080/login/oauth2/code/google
 *
 * (로컬에서 API URL 을 127.0.0.1 로 쓰면 Google 에 아래도 동일하게 등록해야 함 — localhost 와 별개)
 *   http://127.0.0.1:8080/login/oauth2/code/google
 *
 * 「승인된 JavaScript 생성자」(Authorized JavaScript origins) — 팝업/브라우저 출처 허용:
 *   https://pickty.app
 *   https://www.pickty.app
 *   http://localhost:3002
 *   http://127.0.0.1:3002
 *
 * Kakao Developers → Redirect URI:
 *   https://api.pickty.app/login/oauth2/code/kakao
 *   http://localhost:8080/login/oauth2/code/kakao
 *
 * 네이버 개발자 센터 → Callback URL:
 *   https://api.pickty.app/login/oauth2/code/naver
 *   http://localhost:8080/login/oauth2/code/naver
 */
@Component
class OAuth2SuccessHandler(
    private val jwtTokenProvider: JwtTokenProvider,
    private val refreshTokenService: RefreshTokenService,
    private val oauthExchangeService: OAuthExchangeService,
    private val refreshTokenCookieWriter: RefreshTokenCookieWriter,
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
    private val redisTemplate: StringRedisTemplate,
    private val objectMapper: ObjectMapper,
    @Value("\${app.frontend-url:https://pickty.app}") private val frontendUrl: String,
    @Value("\${app.oauth2.allowed-frontend-origins:https://pickty.app,https://www.pickty.app,http://localhost:3002,http://127.0.0.1:3002}") private val allowedOriginsRaw: String,
) : SimpleUrlAuthenticationSuccessHandler() {

    private val allowedOrigins: Set<String> by lazy {
        allowedOriginsRaw.split(",").map { it.trim() }.toSet()
    }

    companion object {
        private const val OAUTH_RAW_KEY_PREFIX = "oauth2:raw:"
        private val OAUTH_RAW_TTL = Duration.ofMinutes(30)
    }

    override fun onAuthenticationSuccess(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authentication: Authentication,
    ) {
        val principal = authentication.principal as PrincipalDetails

        val refreshToken = jwtTokenProvider.generateRefreshToken()
        refreshTokenService.save(principal.userId, refreshToken)
        refreshTokenCookieWriter.write(response, refreshToken)

        val exchangeCode = oauthExchangeService.createForUser(principal.userId)

        // 디버그용: 소셜 로그인 시 OAuth2 provider가 반환한 raw 속성을 30분간 캐시
        val attrsJson = objectMapper.writeValueAsString(principal.attributes)
        redisTemplate.opsForValue().set("$OAUTH_RAW_KEY_PREFIX${principal.userId}", attrsJson, OAUTH_RAW_TTL)

        clearAuthenticationAttributes(request, response)
        CookieUtils.deleteCookie(request, response, OAuthLinkConstants.OAUTH_LINK_COOKIE)

        // 로그인 시작 시점에 저장된 프론트엔드 오리진 쿠키를 읽어 동적 리다이렉트
        // 화이트리스트에 없는 오리진이면 기본 frontendUrl로 폴백
        val savedOrigin = CookieUtils.getCookie(request, HttpCookieOAuth2AuthorizationRequestRepository.OAUTH2_FRONTEND_ORIGIN_COOKIE)?.value
        val resolvedOrigin = savedOrigin?.takeIf { it in allowedOrigins } ?: frontendUrl

        val targetUrl = UriComponentsBuilder
            .fromUriString("$resolvedOrigin/auth/callback")
            .queryParam("exchange", exchangeCode)
            .build().toUriString()

        redirectStrategy.sendRedirect(request, response, targetUrl)
    }

    private fun clearAuthenticationAttributes(request: HttpServletRequest, response: HttpServletResponse) {
        super.clearAuthenticationAttributes(request)
        cookieAuthorizationRequestRepository.removeAuthorizationRequest(request, response)
    }
}
