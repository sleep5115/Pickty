package com.pickty.server.domain.community.dto

import com.pickty.server.domain.interaction.dto.CommentResponse
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateBoardPostRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank @field:Size(max = 200_000) val contentHtml: String,
    @field:Size(min = 2, max = 10, message = "닉네임을 입력해주세요.") val guestNickname: String? = null,
    @field:Size(min = 4, max = 128, message = "비밀번호를 입력해주세요.") val guestPassword: String? = null,
)

data class CreateBoardPostResponse(
    val id: UUID,
)

data class UpdateBoardPostRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank @field:Size(max = 200_000) val contentHtml: String,
    /** 비회원 게시글 수정 시 필수(회원 글은 무시) */
    @field:Size(min = 4, max = 128, message = "비밀번호를 입력해주세요.") val guestPassword: String? = null,
)

data class DeleteBoardPostRequest(
    /** 비회원 게시글 삭제 시 필수(회원 본인·관리자 삭제 시 생략) */
    @field:Size(min = 4, max = 128, message = "비밀번호를 입력해주세요.") val guestPassword: String? = null,
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
