package com.pickty.server.domain.auth.controller

import com.pickty.server.domain.auth.dto.AccessTokenResponse
import com.pickty.server.domain.auth.dto.OAuthExchangeRequest
import com.pickty.server.domain.auth.service.JwtBlacklistService
import com.pickty.server.domain.auth.service.OAuthExchangeService
import com.pickty.server.domain.auth.service.RefreshTokenService
import com.pickty.server.global.jwt.AuthCookieNames
import com.pickty.server.global.jwt.JwtTokenProvider
import com.pickty.server.global.jwt.RefreshTokenCookieWriter
import com.pickty.server.global.oauth2.CookieUtils
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
class AuthSessionController(
    private val refreshTokenService: RefreshTokenService,
    private val jwtTokenProvider: JwtTokenProvider,
    private val jwtBlacklistService: JwtBlacklistService,
    private val oauthExchangeService: OAuthExchangeService,
    private val refreshTokenCookieWriter: RefreshTokenCookieWriter,
) {

    @PostMapping("/oauth-exchange")
    fun oauthExchange(
        @RequestBody body: OAuthExchangeRequest,
        request: HttpServletRequest,
    ): ResponseEntity<AccessTokenResponse> {
        val userId = oauthExchangeService.consume(body.exchangeCode.trim())
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        val refreshCookie = CookieUtils.getCookie(request, AuthCookieNames.REFRESH_TOKEN)?.value
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        if (!refreshTokenService.isValid(userId, refreshCookie)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        }

        val accessToken = jwtTokenProvider.generateAccessToken(userId)
        return ResponseEntity.ok(AccessTokenResponse(accessToken))
    }

    @PostMapping("/refresh")
    fun refresh(request: HttpServletRequest): ResponseEntity<AccessTokenResponse> {
        val refreshCookie = CookieUtils.getCookie(request, AuthCookieNames.REFRESH_TOKEN)?.value
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        val userId = refreshTokenService.resolveUserIdByRefreshToken(refreshCookie)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()

        if (!refreshTokenService.isValid(userId, refreshCookie)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build()
        }

        val accessToken = jwtTokenProvider.generateAccessToken(userId)
        return ResponseEntity.ok(AccessTokenResponse(accessToken))
    }

    @PostMapping("/logout")
    fun logout(
        request: HttpServletRequest,
        response: HttpServletResponse,
        @RequestHeader(value = "Authorization", required = false) authorization: String?,
    ): ResponseEntity<Void> {
        val refreshCookie = CookieUtils.getCookie(request, AuthCookieNames.REFRESH_TOKEN)?.value
        refreshCookie?.let { refreshTokenService.deleteByRefreshToken(it) }
        refreshTokenCookieWriter.clear(response)

        val bearer = authorization
            ?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }
            ?.substring(7)
            ?.trim()
            .orEmpty()

        if (bearer.isNotEmpty() && jwtTokenProvider.isValid(bearer)) {
            val remaining = jwtTokenProvider.remainingValiditySeconds(bearer)
            if (remaining > 0L) {
                jwtBlacklistService.add(bearer, remaining)
            }
        }

        return ResponseEntity.noContent().build()
    }
}