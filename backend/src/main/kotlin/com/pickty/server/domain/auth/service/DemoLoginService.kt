package com.pickty.server.domain.auth.service

import com.pickty.server.domain.user.enums.AccountStatus
import com.pickty.server.domain.user.enums.Role
import com.pickty.server.domain.user.repository.UserRepository
import com.pickty.server.global.jwt.JwtTokenProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.server.ResponseStatusException

data class DemoLoginTokens(
    val accessToken: String,
    val refreshToken: String,
)

@Service
class DemoLoginService(
    private val userRepository: UserRepository,
    private val jwtTokenProvider: JwtTokenProvider,
    private val refreshTokenService: RefreshTokenService,
    @Value("\${pickty.demo-login.enabled:true}") private val enabled: Boolean,
    @Value("\${pickty.demo-login.user-email:demo-user@pickty.app}") private val demoUserEmail: String,
) {
    fun login(): DemoLoginTokens {
        if (!enabled) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND)
        }

        val user = userRepository.findByEmail(demoUserEmail)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "demo account not found") }

        if (user.accountStatus != AccountStatus.ACTIVE || user.role != Role.USER) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "demo account is not active")
        }

        val refreshToken = jwtTokenProvider.generateRefreshToken()
        refreshTokenService.save(user.id, refreshToken)

        return DemoLoginTokens(
            accessToken = jwtTokenProvider.generateAccessToken(user.id),
            refreshToken = refreshToken,
        )
    }
}
