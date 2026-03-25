package com.pickty.server.domain.tier.dto

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateTemplateRequest(
    @field:NotBlank @field:Size(max = 500) val title: String,
    /** JSONB에 그대로 저장. 권장: `{ "items": [ { "id", "name", "imageUrl?" } ] }` */
    @field:NotNull val items: Map<String, Any?>,
    val parentTemplateId: UUID? = null,
    /** 목록·OG용 단일 썸네일 URL (https) — 없으면 null */
    @field:Size(max = 2048) val thumbnailUrl: String? = null,
)

data class TemplateResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val parentTemplateId: UUID?,
    val creatorId: Long?,
    /** 저장 직후 확인용 — 목록·상세와 동일 규칙으로 정규화된 URL 또는 null */
    val thumbnailUrl: String?,
)

/** 템플릿 JSONB(items) 전체 + 메타 — 티어 메이커 진입 시 풀 복원용 */
data class TemplateDetailResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val parentTemplateId: UUID?,
    val items: Map<String, Any?>,
    val thumbnailUrl: String?,
)

/** 목록 카드용 — JSONB에서 설명·썸네일·개수만 추출 */
data class TemplateSummaryResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val itemCount: Int,
    val description: String?,
    /** 단일 썸네일 — 없으면 null (프론트 플레이스홀더) */
    val thumbnailUrl: String?,
)

data class CreateTierResultRequest(
    @field:NotNull val templateId: UUID,
    @field:NotNull val snapshotData: Map<String, Any?>,
    val isPublic: Boolean = false,
    @field:Size(max = 500) val listTitle: String? = null,
    @field:Size(max = 10000) val listDescription: String? = null,
    @field:Size(max = 2048) val thumbnailUrl: String? = null,
)

data class TierResultResponse(
    val id: UUID,
    val templateId: UUID,
    val templateTitle: String,
    val templateVersion: Int,
    val listTitle: String?,
    val listDescription: String?,
    val snapshotData: Map<String, Any?>,
    val isPublic: Boolean,
    val isTemporary: Boolean,
    val userId: Long?,
    val thumbnailUrl: String?,
)

/** 내 티어표 목록 — 스냅샷 JSON 제외 */
data class TierResultSummaryResponse(
    val id: UUID,
    val templateId: UUID,
    val templateTitle: String,
    val templateVersion: Int,
    val listTitle: String?,
    val listDescription: String?,
    val isPublic: Boolean,
    val createdAt: String,
    val thumbnailUrl: String?,
)
