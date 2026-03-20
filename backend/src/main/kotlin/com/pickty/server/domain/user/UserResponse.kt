package com.pickty.server.domain.user

data class UserResponse(
    val id: Long,
    val email: String?,
    val nickname: String,
    val profileImageUrl: String?,
    val role: String,
    val providers: List<String>,
    val createdAt: String,
)
