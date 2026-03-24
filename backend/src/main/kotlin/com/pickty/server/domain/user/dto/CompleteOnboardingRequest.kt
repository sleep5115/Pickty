package com.pickty.server.domain.user.dto

import com.pickty.server.domain.user.Gender
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CompleteOnboardingRequest(
    @field:NotBlank
    @field:Size(min = 2, max = 20)
    val nickname: String,
    /** `POST /api/v1/images` 업로드 후 받은 공개 URL */
    @field:Size(max = 2048)
    val displayAvatarUrl: String? = null,
    val gender: Gender? = null,
    /** 선택. 서비스에서 연도 범위(예: 1900 ~ 올해) 검증 */
    val birthYear: Int? = null,
)
