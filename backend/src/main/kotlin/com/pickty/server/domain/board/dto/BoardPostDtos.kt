package com.pickty.server.domain.board.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateBoardPostRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank @field:Size(max = 200_000) val contentHtml: String,
    @field:Size(max = 64) val guestNickname: String? = null,
    @field:Size(max = 128) val guestPassword: String? = null,
)

data class CreateBoardPostResponse(
    val id: UUID,
)

data class BoardPostSummaryResponse(
    val id: UUID,
    val title: String,
    val viewCount: Long,
    val createdAt: String,
    val authorUserId: Long?,
    val authorNickname: String,
    val authorIpPrefix: String?,
)

data class BoardPostDetailResponse(
    val id: UUID,
    val title: String,
    val contentHtml: String,
    val viewCount: Long,
    val createdAt: String,
    val updatedAt: String,
    val authorUserId: Long?,
    val authorNickname: String,
    val authorIpPrefix: String?,
    val authorAvatarUrl: String?,
)
