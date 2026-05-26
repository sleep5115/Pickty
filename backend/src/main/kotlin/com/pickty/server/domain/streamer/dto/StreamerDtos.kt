package com.pickty.server.domain.streamer.dto

import com.pickty.server.domain.streamer.enums.StreamerSessionStatus
import com.pickty.server.domain.streamer.enums.StreamerTemplateType
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateStreamerSessionRequest(
    @field:NotNull(message = "templateType은 필수입니다.")
    val templateType: StreamerTemplateType,
    @field:NotNull(message = "templateId는 필수입니다.")
    val templateId: UUID,
)

data class CreatedStreamerSessionResponse(
    val sessionId: UUID,
    val hostToken: String,
    val templateType: StreamerTemplateType,
    val templateId: UUID,
    val startedAt: Long,
)

data class FallbackHostTokenResponse(
    val sessionId: UUID,
    val hostToken: String,
)

data class UpdateCurrentMatchRequest(
    @field:NotBlank(message = "leftId는 필수입니다.")
    @field:Size(max = 128)
    val leftId: String,
    @field:NotBlank(message = "rightId는 필수입니다.")
    @field:Size(max = 128)
    val rightId: String,
    @field:Size(max = 64, message = "label은 64자 이하로 입력해 주세요.")
    val label: String? = null,
)

data class StartQuickVoteRequest(
    @field:NotBlank(message = "itemId는 필수입니다.")
    @field:Size(max = 128)
    val itemId: String,
)

data class IssueSseTicketResponse(
    val ticketId: UUID,
    val expiresInSeconds: Long,
)

data class CurrentMatchPayload(
    val leftId: String,
    val rightId: String,
    val label: String?,
)

data class StreamerSessionStatusResponse(
    val sessionId: UUID,
    val status: StreamerSessionStatus,
    val templateType: StreamerTemplateType,
    val templateId: UUID,
    val version: Long,
    val currentMatch: CurrentMatchPayload?,
    val quickVoteItemId: String?,
    val nextPollIntervalSeconds: Int,
    val activeUserCount: Long,
)

data class WorldcupVoteRequest(
    @field:NotBlank(message = "leftId는 필수입니다.")
    @field:Size(max = 128)
    val leftId: String,
    @field:NotBlank(message = "rightId는 필수입니다.")
    @field:Size(max = 128)
    val rightId: String,
    @field:NotBlank(message = "selectedId는 필수입니다.")
    @field:Size(max = 128)
    val selectedId: String,
    @field:NotBlank(message = "visitorId는 필수입니다.")
    @field:Size(min = 8, max = 64, message = "visitorId 길이가 잘못되었습니다.")
    val visitorId: String,
)

data class WorldcupVoteResponse(
    val accepted: Boolean,
    val duplicate: Boolean,
    val votes: Map<String, Long>,
)
