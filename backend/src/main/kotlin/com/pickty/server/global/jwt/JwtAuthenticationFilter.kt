package com.pickty.server.global.jwt

import com.pickty.server.domain.auth.service.JwtBlacklistService
import com.pickty.server.domain.user.enums.AccountStatus
import com.pickty.server.domain.user.repository.UserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.ObjectMapper

@Component
class JwtAuthenticationFilter(
    private val jwtTokenProvider: JwtTokenProvider,
    private val userRepository: UserRepository,
    private val jwtBlacklistService: JwtBlacklistService,
    private val objectMapper: ObjectMapper,
) : OncePerRequestFilter() {

    override fun shouldNotFilter(request: HttpServletRequest): Boolean {
        val path = request.requestURI
        return path.startsWith("/oauth2/") || path.startsWith("/login/oauth2/")
    }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val token = resolveToken(request)
        if (!token.isNullOrBlank()) {
            val skipBlacklist = request.requestURI == "/api/v1/auth/logout" &&
                request.method.equals("POST", ignoreCase = true)
            if (!skipBlacklist && jwtBlacklistService.isBlacklisted(token)) {
                respondUnauthorized(response)
                return
            }
        }

        token
            ?.takeIf { jwtTokenProvider.isValid(it) }
            ?.let { validToken ->
                runCatching {
                    val userId = jwtTokenProvider.getUserId(validToken)
                    userRepository.findById(userId).ifPresent { user ->
                        if (user.accountStatus == AccountStatus.MERGED || user.accountStatus == AccountStatus.DELETED) {
                            return@ifPresent
                        }
                        val auth = UsernamePasswordAuthenticationToken(
                            userId, null,
                            listOf(SimpleGrantedAuthority("ROLE_${user.role.name}")),
                        )
                        auth.details = WebAuthenticationDetailsSource().buildDetails(request)
                        SecurityContextHolder.getContext().authentication = auth
                    }
                }
            }
        filterChain.doFilter(request, response)
    }

    private fun respondUnauthorized(response: HttpServletResponse) {
        response.status = HttpServletResponse.SC_UNAUTHORIZED
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body = mapOf(
            "status" to 401,
            "error" to "Unauthorized",
            "message" to "무효화된 토큰입니다.",
        )
        objectMapper.writeValue(response.writer, body)
    }

    private fun resolveToken(request: HttpServletRequest): String? =
        request.getHeader("Authorization")
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
}
