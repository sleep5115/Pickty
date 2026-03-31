package com.pickty.server.domain.tier.dto

import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size

/**
 * 보드 전체 배경(선택). 둘 다 생략하면 클라이언트가 테마 기본 배경을 씀.
 */
data class TemplateBoardSurfacePayload(
    @field:Pattern(
        regexp = "^#[0-9A-Fa-f]{6}$",
        message = "보드 배경색은 #RRGGBB 형식이어야 합니다.",
    )
    val backgroundColor: String? = null,
    @field:Size(max = 2048, message = "배경 이미지 URL은 2048자 이하로 입력해 주세요.")
    val backgroundUrl: String? = null,
)

/**
 * 티어 라벨 행 1줄 — 프론트 [Tier]와 동일 필드.
 */
data class TemplateBoardRowPayload(
    @field:NotBlank(message = "행 id는 필수입니다.")
    @field:Size(max = 100, message = "행 id는 100자 이하로 입력해 주세요.")
    val id: String,
    @field:NotBlank(message = "라벨을 입력해 주세요.")
    @field:Size(min = 1, max = 10, message = "라벨은 1~10자 이하여야 합니다.")
    val label: String,
    @field:NotBlank(message = "행 배경색을 입력해 주세요.")
    @field:Pattern(
        regexp = "^#[0-9A-Fa-f]{6}$",
        message = "행 배경색은 #RRGGBB 형식이어야 합니다.",
    )
    val color: String,
    @field:Pattern(
        regexp = "^#[0-9A-Fa-f]{6}$",
        message = "라벨 글자색은 #RRGGBB 형식이어야 합니다.",
    )
    val textColor: String? = null,
    val paintLabelColorUnderImage: Boolean? = null,
    val showLabelColor: Boolean? = null,
    @field:Size(max = 2048, message = "행 배경 이미지 URL은 2048자 이하로 입력해 주세요.")
    val backgroundUrl: String? = null,
)

/**
 * 템플릿 생성 시 선택적 도화지. [CreateTemplateRequest.boardConfig].
 * Fork 시 요청에 없으면 부모 [board_config]를 복사한다.
 */
data class TemplateBoardConfigPayload(
    @field:Min(value = 1, message = "schemaVersion은 1 이상이어야 합니다.")
    @field:Max(value = 1, message = "지원하는 schemaVersion은 1뿐입니다.")
    val schemaVersion: Int = 1,
    @field:Valid val board: TemplateBoardSurfacePayload? = null,
    @field:NotEmpty(message = "티어 행을 1개 이상 지정해 주세요.")
    @field:Size(max = 20, message = "티어 행은 20개 이하여야 합니다.")
    @field:Valid
    val rows: List<TemplateBoardRowPayload>,
)
