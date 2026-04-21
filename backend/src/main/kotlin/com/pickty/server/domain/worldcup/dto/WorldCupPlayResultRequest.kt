package com.pickty.server.domain.worldcup.dto

import tools.jackson.databind.JsonNode
import java.util.UUID

/** 클라이언트가 한 판 종료 후 전송하는 결과·선택 이력 */
data class WorldCupPlayResultRequest(
    val templateId: UUID,
    val winnerItemId: String,
    /** JSON 배열 — 프론트 `WorldCupMatchHistoryEntry[]` 와 동형 (Spring MVC Jackson 3) */
    val matchHistory: JsonNode,
    /** 한 판 통계 델타 — `WorldCupStatService` 반영용(스토어 `itemStats` 와 동형) */
    val itemStats: Map<String, WorldCupItemStatPayload> = emptyMap(),
)
