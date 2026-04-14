package com.pickty.server.domain.interaction.dto

import java.time.LocalDateTime
import java.util.UUID

/**
 * 댓글 목록 응답. 비회원은 [authorName]·[authorIpPrefix] 로 클라이언트가 `익명(118.235)` 형태 조합.
 * 회원은 [memberNickname] 만 채운다(비밀번호·IP 해시 미노출).
 */
data class CommentResponse(
    val id: UUID,
    val body: String,
    val parentCommentId: UUID?,
    val createdAt: LocalDateTime,
    /** 비회원 저장 닉네임(비어 있으면 서버에서 "익명"으로 저장됨) */
    val authorName: String?,
    /** 비회원만 — 앞 두 옥텟/세그먼트 */
    val authorIpPrefix: String?,
    /** 회원만 */
    val memberNickname: String?,
    /** 회원 댓글만 — 삭제 권한 UI 용 (비회원은 null) */
    val authorUserId: Long? = null,
)
