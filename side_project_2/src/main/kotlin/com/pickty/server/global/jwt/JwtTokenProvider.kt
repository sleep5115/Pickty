package com.pickty.server.global.jwt

import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwsHeader
import org.springframework.security.oauth2.jwt.JwtClaimsSet
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.JwtEncoderParameters
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID

@Component
class JwtTokenProvider(
    private val jwtEncoder: JwtEncoder,
    private val jwtDecoder: JwtDecoder,
    private val jwtProperties: JwtProperties,
) {

    fun generateAccessToken(userId: Long, email: String?): String {
        val now = Instant.now()
        val header = JwsHeader.with(MacAlgorithm.HS256).build()
        val claims = JwtClaimsSet.builder()
            .subject(userId.toString())
            .issuer("pickty")
            .issuedAt(now)
            .expiresAt(now.plusSeconds(jwtProperties.accessTokenExpirationSeconds))
            .apply { if (email != null) claim("email", email) }
            .build()
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).tokenValue
    }

    fun generateRefreshToken(): String = UUID.randomUUID().toString()

    fun getUserId(token: String): Long = jwtDecoder.decode(token).subject.toLong()

    fun isValid(token: String): Boolean = runCatching { jwtDecoder.decode(token) }.isSuccess
}
