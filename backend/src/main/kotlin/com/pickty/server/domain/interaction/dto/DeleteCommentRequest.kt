package com.pickty.server.domain.interaction.dto

import jakarta.validation.constraints.Size

/** 비회원 댓글 삭제 시 평문 비밀번호 — 회원 삭제 시 null */
data class DeleteCommentRequest(
    @field:Size(min = 4, max = 128, message = "비밀번호를 입력해주세요.") val guestPassword: String? = null,
)
