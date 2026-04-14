package com.pickty.server.domain.user.dto

/**
 * 연동된 소셜 계정별로 제공처에서 넘어온 표시명·이메일·프로필 이미지 — **내 계정 > 상세** 에서만 요청.
 */
data class SensitiveLinkedAccountDto(
    val provider: String,
    val email: String?,
    val name: String?,
    val profileImageUrl: String?,
)

data class UserSensitiveProfileResponse(
    val linkedAccounts: List<SensitiveLinkedAccountDto>,
)
