package com.pickty.server.global.jwt

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "jwt")
data class JwtProperties(
    val secret: String = "",
    val accessTokenExpirationSeconds: Long = 3600,
    val refreshTokenExpirationSeconds: Long = 604800,
)
