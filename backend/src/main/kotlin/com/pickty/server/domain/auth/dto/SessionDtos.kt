package com.pickty.server.domain.auth.dto

data class OAuthExchangeRequest(
    val exchangeCode: String,
)

data class AccessTokenResponse(
    val accessToken: String,
)
