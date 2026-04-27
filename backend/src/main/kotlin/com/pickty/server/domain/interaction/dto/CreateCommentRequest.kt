package com.pickty.server.domain.interaction.dto

import com.pickty.server.domain.interaction.enums.ReactionTargetType
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateCommentRequest(
    val targetType: ReactionTargetType,
    val targetId: UUID,
    @field:NotBlank @field:Size(max = 10_000) val body: String,
    val parentCommentId: UUID? = null,
    /** 비회원 전용 — 회원 작성 시 서비스에서 무시 */
    @field:Size(min = 2, max = 10, message = "닉네임을 입력해주세요.") val authorName: String? = null,
    /** 평문 — 서비스에서 해시 후 저장 */
    @field:Size(min = 4, max = 128, message = "비밀번호를 입력해주세요.") val guestPassword: String? = null,
)
