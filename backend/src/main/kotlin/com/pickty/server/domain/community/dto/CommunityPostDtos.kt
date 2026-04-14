package com.pickty.server.domain.community.dto

import com.pickty.server.domain.interaction.dto.CommentResponse
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

/** 게시글 상세에 포함하는 댓글 첫 페이지(페이지 API와 동일 필드) */
data class BoardPostCommentsPageResponse(
    val content: List<CommentResponse>,
    val totalElements: Long,
    val totalPages: Int,
    val size: Int,
    val number: Int,
    val first: Boolean,
    val last: Boolean,
    val empty: Boolean,
)

data class BoardPostDetailResponse(
    val id: UUID,
    val title: String,
    val contentHtml: String,
    val viewCount: Long,
    val commentCount: Long,
    val createdAt: String,
    val updatedAt: String,
    val authorUserId: Long?,
    val authorNickname: String,
    val authorIpPrefix: String?,
    val authorAvatarUrl: String?,
    val comments: BoardPostCommentsPageResponse,
)
