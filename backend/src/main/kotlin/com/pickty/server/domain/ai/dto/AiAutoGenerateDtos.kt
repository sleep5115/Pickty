package com.pickty.server.domain.ai.dto

import com.fasterxml.jackson.annotation.JsonValue
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

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
    @field:Max(50)
    val count: Int = 2,
)

data class AiAutoGenerateItemResponse(
    val name: String,
    val candidates: List<MediaCandidate>,
)
