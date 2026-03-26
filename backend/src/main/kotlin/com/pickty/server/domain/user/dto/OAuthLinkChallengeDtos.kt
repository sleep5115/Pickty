package com.pickty.server.domain.user.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern

data class OAuthLinkChallengeRequest(
    @field:NotBlank
    @field:Pattern(regexp = "^(google|kakao|naver)$", message = "registrationId는 google, kakao, naver만 허용됩니다.")
    val registrationId: String,
)

data class OAuthLinkChallengeResponse(
    /** 팝업에서 열 경로 (API 호스트 붙임). 예: `/oauth2/link/start?t=...&registrationId=kakao` */
    val path: String,
)
