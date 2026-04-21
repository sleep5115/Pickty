package com.pickty.server.domain.user.dto

import com.pickty.server.domain.user.enums.Gender
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

/** 활성 계정 프로필 수정 (`PATCH /me/profile`). 클라이언트는 변경 없을 때도 `displayAvatarUrl` 에 현재 공개 아바타 URL(또는 null)을 넣어 전송한다. */
data class UpdateProfileRequest(
    @field:NotBlank
    @field:Size(min = 2, max = 20)
    val nickname: String,
    @field:Size(max = 2048)
    val displayAvatarUrl: String? = null,
    val gender: Gender? = null,
    val birthYear: Int? = null,
)
