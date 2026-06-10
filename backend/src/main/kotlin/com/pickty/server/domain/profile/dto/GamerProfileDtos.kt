package com.pickty.server.domain.profile.dto

import com.pickty.server.domain.profile.entity.GamerProfile
import com.pickty.server.domain.profile.entity.GamerProfileCard
import com.pickty.server.domain.profile.enums.GameSource
import com.pickty.server.domain.profile.enums.GamerProfileFeedType
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

// ---------- 요청 ----------

/** 카드 하위 Key-Value 스탯 슬롯. */
data class GamerProfileStatRequest(
    @field:NotBlank @field:Size(max = 100) val statKey: String,
    @field:NotBlank @field:Size(max = 100) val statValue: String,
)

/** 게임 카드 1개(메타 + 스탯 목록). */
data class GamerProfileCardRequest(
    @field:NotBlank @field:Size(max = 100) val gameSlug: String,
    val gameSource: GameSource,
    @field:NotBlank @field:Size(max = 100) val gameTitle: String,
    @field:Size(max = 255) val gameIconUrl: String? = null,
    @field:Size(max = 100) val externalApiIdentifier: String? = null,
    /** 신문 격자에서 대형 강조할 대표 게임 여부. 여러 개면 서비스에서 첫 카드만 채택. */
    val isMain: Boolean = false,
    val stats: List<GamerProfileStatRequest> = emptyList(),
)

/** 현실 피드 사진 또는 인증샷 1개. */
data class GamerProfileFeedRequest(
    @field:NotBlank @field:Size(max = 255) val imageUrl: String,
    @field:Size(max = 255) val description: String? = null,
    val feedType: GamerProfileFeedType = GamerProfileFeedType.REALITY,
)

/** 카드 + 피드 (수정 PUT 본문). 닉네임·한줄소개·아바타는 스펙아웃. */
data class GamerProfileUpdateRequest(
    val cards: List<GamerProfileCardRequest> = emptyList(),
    val feeds: List<GamerProfileFeedRequest> = emptyList(),
)

/** 프로필 최초 생성 (주소 ID·암구호 선점 + 카드/피드). */
data class GamerProfileCreateRequest(
    @field:NotBlank @field:Size(min = 3, max = 50) val customSlug: String,
    /** 비회원만 필수. 회원(소셜 로그인)은 생략 — user_id 로 소유권 판별. */
    val guestPassword: String? = null,
    val cards: List<GamerProfileCardRequest> = emptyList(),
    val feeds: List<GamerProfileFeedRequest> = emptyList(),
)

/** 비회원 수정용 암구호 검증. */
data class GamerProfileVerifyPasswordRequest(
    @field:NotBlank val password: String,
)

// ---------- 응답 ----------

data class GamerProfileStatResponse(
    val statKey: String,
    val statValue: String,
)

data class GamerProfileCardResponse(
    val id: Long,
    val gameSlug: String,
    val gameSource: GameSource,
    val gameTitle: String,
    val gameIconUrl: String?,
    val externalApiIdentifier: String?,
    val isMain: Boolean,
    val displayOrder: Int,
    val stats: List<GamerProfileStatResponse>,
) {
    companion object {
        fun from(card: GamerProfileCard): GamerProfileCardResponse =
            GamerProfileCardResponse(
                id = card.id!!,
                gameSlug = card.gameSlug,
                gameSource = card.gameSource,
                gameTitle = card.gameTitle,
                gameIconUrl = card.gameIconUrl,
                externalApiIdentifier = card.externalApiIdentifier,
                isMain = card.isMain,
                displayOrder = card.displayOrder,
                stats = card.stats.map { GamerProfileStatResponse(it.statKey, it.statValue) },
            )
    }
}

data class GamerProfileFeedResponse(
    val id: Long,
    val imageUrl: String,
    val description: String?,
    val feedType: GamerProfileFeedType,
    val displayOrder: Int,
)

data class GamerProfileResponse(
    val slug: String,
    /** 회원 소유 프로필 여부(true=회원, false=비회원). */
    val isMember: Boolean,
    /** 인증샷(proof) 1개 이상 첨부 시 true → 카드 꼬리말에 공유 주소 노출. */
    val verified: Boolean,
    /** verified=true 일 때만 채워지는 공유용 상세 주소(pickty.app/profile/{slug}). */
    val shareUrl: String?,
    val cards: List<GamerProfileCardResponse>,
    val feeds: List<GamerProfileFeedResponse>,
    val createdAt: String,
    val updatedAt: String,
) {
    companion object {
        fun from(profile: GamerProfile, publicBaseUrl: String): GamerProfileResponse {
            val cards = profile.cards.map { GamerProfileCardResponse.from(it) }
            val verified = profile.feeds.any { it.feedType == GamerProfileFeedType.PROOF }
            val slug = profile.customSlug
            return GamerProfileResponse(
                slug = slug,
                isMember = !profile.isGuest,
                verified = verified,
                shareUrl = if (verified) "$publicBaseUrl/profile/$slug" else null,
                cards = cards,
                feeds = profile.feeds.map {
                    GamerProfileFeedResponse(it.id!!, it.imageUrl, it.description, it.feedType, it.displayOrder)
                },
                createdAt = profile.createdAt.toString(),
                updatedAt = profile.updatedAt.toString(),
            )
        }
    }
}

/** 최초 생성 응답 — 슬러그와(비회원이면) 즉시 편집용 토큰. */
data class GamerProfileCreateResponse(
    val slug: String,
    /** 비회원: 방금 생성한 프로필을 재인증 없이 바로 편집할 수 있는 토큰. 회원은 null. */
    val editToken: String?,
)

data class GamerProfileSlugCheckResponse(
    val slug: String,
    val available: Boolean,
)

data class GamerProfileVerifyPasswordResponse(
    val editToken: String,
    val expiresInSeconds: Long,
)
