package com.pickty.server.global.jwt

import jakarta.servlet.http.Cookie
import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class RefreshTokenCookieWriter(
    private val jwtProperties: JwtProperties,
    @Value("\${app.auth.refresh-cookie.secure:true}") private val secure: Boolean,
    @Value("\${app.auth.refresh-cookie.same-site:Lax}") private val sameSite: String,
    @Value("\${app.auth.refresh-cookie.domain:}") private val domainRaw: String,
) {

    private val domain: String? =
        domainRaw.trim().takeIf { it.isNotEmpty() }

    fun write(response: HttpServletResponse, refreshToken: String) {
        val maxAge = jwtProperties.refreshTokenExpirationSeconds.toInt().coerceAtLeast(1)
        val cookie = Cookie(AuthCookieNames.REFRESH_TOKEN, refreshToken).apply {
            path = "/"
            isHttpOnly = true
            this.secure = secure
            setMaxAge(maxAge)
            domain?.let { setDomain(it) }
            setAttribute("SameSite", sameSite)
        }
        response.addCookie(cookie)
    }

    fun clear(response: HttpServletResponse) {
        val cookie = Cookie(AuthCookieNames.REFRESH_TOKEN, "").apply {
            path = "/"
            isHttpOnly = true
            secure = secure
            setMaxAge(0)
            domain?.let { setDomain(it) }
            setAttribute("SameSite", sameSite)
        }
        response.addCookie(cookie)
    }
}
