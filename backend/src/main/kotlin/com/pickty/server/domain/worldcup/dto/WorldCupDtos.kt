package com.pickty.server.domain.worldcup.dto

import com.pickty.server.domain.interaction.enums.ReactionType
import com.pickty.server.domain.tier.dto.TemplateItemPayload
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.util.UUID

data class CreateWorldCupTemplateRequest(
    @field:NotBlank(message = "템플릿 제목을 입력해 주세요.")
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.")
    val title: String,
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.")
    val description: String? = null,
    /** 클라이언트가 합성·업로드한 목록 썸네일. 비어 있으면 서버가 첫 미디어 URL 등으로 추론 */
    @field:Size(max = 2048, message = "썸네일 URL은 2048자 이하로 입력해 주세요.")
    val thumbnailUrl: String? = null,
    /** `split_lr` | `split_diagonal` */
    @field:NotBlank(message = "레이아웃 모드를 선택해 주세요.")
    @field:Size(max = 32)
    val layoutMode: String,
    @field:NotEmpty(message = "아이템을 1개 이상 추가해 주세요.")
    @field:Valid
    val items: List<TemplateItemPayload>,
)

data class UpdateWorldCupTemplateMetaRequest(
    @field:NotBlank(message = "템플릿 제목을 입력해 주세요.")
    @field:Size(max = 100, message = "제목은 100자 이하로 입력해 주세요.")
    val title: String,
    @field:Size(max = 10000, message = "설명은 10000자 이하로 입력해 주세요.")
    val description: String? = null,
    /** 생략 시 기존 값 유지. `split_lr` | `split_diagonal` */
    @field:Size(max = 32, message = "레이아웃 값이 너무 깁니다.")
    val layoutMode: String? = null,
)

data class PatchWorldCupTemplateMetaResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val description: String?,
    val layoutMode: String,
)

data class WorldCupTemplateCreatedResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val creatorId: Long?,
    val thumbnailUrl: String?,
)

data class WorldCupTemplateSummaryResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val description: String?,
    val thumbnailUrl: String?,
    val creatorId: Long?,
    val layoutMode: String,
    /** JSONB `items` 배열 길이 */
    val itemCount: Int = 0,
    val likeCount: Long = 0,
    val commentCount: Long = 0,
    val viewCount: Long = 0,
    val myReaction: ReactionType? = null,
)

/** 상세 — 아이템 JSON 배열 전체 */
data class WorldCupTemplateDetailResponse(
    val id: UUID,
    val title: String,
    val version: Int,
    val description: String?,
    val items: List<Map<String, Any?>>,
    val thumbnailUrl: String?,
    val creatorId: Long?,
    val layoutMode: String,
    val likeCount: Long = 0,
    val commentCount: Long = 0,
    val viewCount: Long = 0,
)
