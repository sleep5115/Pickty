package com.pickty.server.domain.ai.dto

import com.fasterxml.jackson.annotation.JsonValue
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size

enum class AiMediaType(@get:JsonValue val wire: String) {
    PHOTO("PHOTO"),
    GIF("GIF"),
    YOUTUBE("YOUTUBE"),
    ;

    companion object {
        fun fromWire(raw: String?): AiMediaType? =
            entries.firstOrNull { it.wire.equals(raw, ignoreCase = true) }
    }
}

data class AiAutoGenerateRequest(
    @field:NotBlank val prompt: String,
    @field:NotNull val mediaType: AiMediaType,
    @field:Min(1)
    @field:Max(10)
    val count: Int = 2,
    /** 에디터에 이미 있는 후보 이름 — AI 추가 생성 시 중복 방지용(프롬프트에만 반영) */
    @field:Size(max = 200)
    val existingItemNames: List<String> = emptyList(),
)

data class AiAutoGenerateItemResponse(
    val name: String,
    val candidates: List<MediaCandidate>,
)
