package com.pickty.server.domain.profile.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// ---------- AI 자연어 카드 생성 ----------

/** "할나 5문 깼고 스타듀밸리 2500시간 함" 같은 자유 문장. */
data class GamerProfileAiGenerateRequest(
    @field:NotBlank @field:Size(max = 1000) val text: String,
)

/** Gemini JSON Mode 로 파싱한 카드 1개 → 프론트가 편집 폼에 병합. */
data class GamerProfileAiCard(
    val gameTitle: String,
    val gameSlug: String,
    /** 마스터 매칭 실패(프리셋 아이콘 사용) 여부. */
    val isCustom: Boolean,
    val gameIconUrl: String?,
    val stats: List<GamerProfileStatResponse>,
)

data class GamerProfileAiGenerateResponse(
    val games: List<GamerProfileAiCard>,
)

// ---------- 외부 게임 API 조회(LoL/오버워치) ----------

data class GamerProfileGameStatsRequest(
    @field:NotBlank @field:Size(max = 100) val gameSlug: String,
    /** 닉네임#태그 등 조회 식별값. */
    @field:NotBlank @field:Size(max = 100) val identifier: String,
)

data class GamerProfileGameStatsResponse(
    val gameSlug: String,
    val gameTitle: String,
    val gameIconUrl: String?,
    val stats: List<GamerProfileStatResponse>,
    /** API 키 미설정·통신 실패로 Mock 데이터를 채웠는지 여부. */
    val mock: Boolean,
)
