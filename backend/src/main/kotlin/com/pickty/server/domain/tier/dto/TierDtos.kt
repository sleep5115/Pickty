package com.pickty.server.domain.tier.dto

import com.pickty.server.domain.community.ReactionType
import com.pickty.server.domain.tier.ResultStatus
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.util.UUID

/** 템플릿 JSONB(items) — 프론트 Zod와 동일한 길이 제한 */
data class TemplateItemPayload(
    @field:NotBlank(message = "아이템 id는 필수입니다.")
    @field:Size(max = 100, message = "아이템 id는 100자 이하로 입력해 주세요.")
    val id: String,
    @field:NotBlank(message = "아이템 이름을 입력해 주세요.")
    @field:Size(max = 100, message = "이름은 100자 이하로 입력해 주세요.")
    val name: String,
    @field:Size(max = 2048, message = "이미지 URL은 2048자 이하로 입력해 주세요.")
    val imageUrl: String? = null,
)

data class TemplateItemsPayload(
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.")
    val description: String? = null,
    @field:NotEmpty(message = "아이템을 1개 이상 추가해 주세요.")
    @field:Valid
    val items: List<TemplateItemPayload>,
)

data class CreateTemplateRequest(
    @field:NotBlank(message = "템플릿 제목을 입력해 주세요.")
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.")
    val title: String,
    @field:NotNull @field:Valid val items: TemplateItemsPayload,
    val parentTemplateId: UUID? = null,
    @field:Size(max = 2048, message = "썸네일 URL은 2048자 이하로 입력해 주세요.")
    val thumbnailUrl: String? = null,
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
    /** 작성자 — 헤더 케밥 권한 등 (null 이면 구 데이터) */
    val creatorId: Long?,
    val likeCount: Long = 0,
    val commentCount: Long = 0,
    /** 로그인 사용자 본인 반응 — 비로그인·없음이면 null */
    val myReaction: ReactionType? = null,
)

/** 템플릿 제목·설명만 수정 (JSONB `items` 배열 불변) */
data class UpdateTemplateMetaRequest(
    @field:NotBlank(message = "템플릿 제목을 입력해 주세요.")
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.")
    val title: String,
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.")
    val description: String? = null,
)

/** PATCH 메타 응답 — 목록 카드 갱신용 */
data class PatchTemplateMetaResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val description: String?,
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
    /** 작성자 — null 이면 구 데이터·익명 */
    val creatorId: Long?,
    val likeCount: Long = 0,
    val commentCount: Long = 0,
    val myReaction: ReactionType? = null,
)

data class CreateTierResultRequest(
    @field:NotNull val templateId: UUID,
    @field:NotNull val snapshotData: Map<String, Any?>,
    val isPublic: Boolean = false,
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.") val listTitle: String? = null,
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.") val listDescription: String? = null,
    @field:Size(max = 2048, message = "썸네일 URL은 2048자 이하로 입력해 주세요.") val thumbnailUrl: String? = null,
)

/**
 * PATCH 메타 병합 시 [jakarta.validation.Validator.validateProperty] 용 프로브.
 * (JsonNode 병합과 함께 사용 — 필드별 @Size 메시지 유지)
 */
data class UpdateTierResultMetaRequest(
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.")
    val title: String? = null,
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.")
    val description: String? = null,
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
    val resultStatus: ResultStatus,
    val userId: Long?,
    val thumbnailUrl: String?,
    val upCount: Long = 0,
    val downCount: Long = 0,
    val commentCount: Long = 0,
    val myReaction: ReactionType? = null,
)

/** 목록 카드용 — 스냅샷 JSON 제외 (글로벌 피드·내 티어표 공통) */
data class TierResultSummaryResponse(
    val id: UUID,
    val templateId: UUID,
    val templateTitle: String,
    val templateVersion: Int,
    val listTitle: String?,
    val listDescription: String?,
    val isPublic: Boolean,
    val resultStatus: ResultStatus,
    /** null 이면 익명·미귀속 결과 */
    val userId: Long?,
    val createdAt: String,
    val thumbnailUrl: String?,
    val upCount: Long = 0,
    val downCount: Long = 0,
    val commentCount: Long = 0,
    val myReaction: ReactionType? = null,
)
