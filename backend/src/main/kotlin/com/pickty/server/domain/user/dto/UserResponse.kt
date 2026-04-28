package com.pickty.server.domain.user.dto

/**
 * 공개·일반 UI용. **이메일·실명·소셜 원본 사진은 포함하지 않는다** (`GET /me/sensitive` 참고).
 * [profileImageUrl] JSON 필드명 유지 — 값은 DB `display_avatar_url`(업로드 아바타)만 반영한다.
 */
data class UserResponse(
    val id: Long,
    val nickname: String,
    val profileImageUrl: String?,
    val role: String,
    val providers: List<String>,
    val createdAt: String,
    val accountStatus: String,
    val gender: String?,
    val birthYear: Int?,
    val demoAiEnabled: Boolean = false,
)
