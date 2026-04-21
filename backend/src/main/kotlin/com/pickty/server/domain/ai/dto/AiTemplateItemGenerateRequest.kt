package com.pickty.server.domain.ai.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class AiTemplateItemGenerateRequest(
    @field:NotBlank(message = "프롬프트를 입력해 주세요.")
    @field:Size(max = 1000, message = "프롬프트는 1000자 이하로 입력해 주세요.")
    val prompt: String,

    val excludeItems: List<String> = emptyList(),

    val requireCount: Int = 20
)
