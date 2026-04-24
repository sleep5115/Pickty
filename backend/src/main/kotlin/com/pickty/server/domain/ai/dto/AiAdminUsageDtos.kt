package com.pickty.server.domain.ai.dto

/**
 * PT(America/Los_Angeles) 자정 기준 일일 외부 검색 API 호출 누적치 — 관리자 조회용.
 */
data class AiAdminUsageResponse(
    val youtube: Long = 0,
    val googleSearch: Long = 0,
)
