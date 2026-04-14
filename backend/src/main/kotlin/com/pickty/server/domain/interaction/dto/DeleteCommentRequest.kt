package com.pickty.server.domain.interaction.dto

import jakarta.validation.constraints.Size

/** 비회원 댓글 삭제 시 평문 비밀번호 — 회원 삭제 시 null */
data class DeleteCommentRequest(
    @field:Size(max = 128) val guestPassword: String? = null,
)
