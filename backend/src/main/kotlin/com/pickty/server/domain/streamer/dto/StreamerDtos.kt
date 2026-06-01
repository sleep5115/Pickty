package com.pickty.server.domain.streamer.dto

import com.pickty.server.domain.streamer.enums.StreamerSessionStatus
import com.pickty.server.domain.streamer.enums.StreamerTemplateType
import jakarta.validation.Valid
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import tools.jackson.databind.JsonNode
import java.util.UUID

data class CreateStreamerSessionRequest(
    @field:NotNull(message = "templateType은 필수입니다.")
    val templateType: StreamerTemplateType,
    @field:NotNull(message = "templateId는 필수입니다.")
    val templateId: UUID,
    /** 티어 모드 — 방장의 커스텀 보드 구성(행 정의·순서 등). 시청자가 동일 보드로 플레이하도록 세션에 저장. */
    val boardConfig: JsonNode? = null,
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
    /** 티어 모드 — 방장이 세션에 올린 커스텀 보드 구성. 시청자가 이 보드로 플레이. 월드컵은 null. */
    val boardConfig: JsonNode? = null,
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

data class TierPlacementDto(
    @field:NotBlank(message = "itemId는 필수입니다.")
    @field:Size(max = 128)
    val itemId: String,
    /** 아이템이 배치된 행 인덱스(0 = 최상단). */
    @field:Min(0, message = "rowIndex는 0 이상이어야 합니다.")
    val rowIndex: Int,
)

data class TierSubmitRequest(
    @field:NotEmpty(message = "placements는 비어 있을 수 없습니다.")
    @field:Size(max = 500, message = "아이템이 너무 많습니다.")
    @field:Valid
    val placements: List<TierPlacementDto>,
    @field:NotBlank(message = "visitorId는 필수입니다.")
    @field:Size(min = 8, max = 64, message = "visitorId 길이가 잘못되었습니다.")
    val visitorId: String,
)

data class TierSubmitResponse(
    val accepted: Boolean,
    val duplicate: Boolean,
    val totalSubmissions: Long,
)

/** 아이템 1개의 시청자 집단 통계 — rowIndex별 표수 분포만 담는다. 평균 위치 계산은 프론트가 수행. */
data class TierItemStat(
    val itemId: String,
    /** rowIndex(문자열) → 표수. 예: {"0": 15, "2": 3}. */
    val distribution: Map<String, Long>,
    val sampleCount: Long,
)

data class TierStatsResponse(
    val totalSubmissions: Long,
    val items: List<TierItemStat>,
)
