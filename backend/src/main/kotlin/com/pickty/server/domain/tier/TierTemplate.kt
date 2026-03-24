package com.pickty.server.domain.tier

import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.Access
import jakarta.persistence.AccessType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

/**
 * 티어표 템플릿 — 아이템 정의(JSONB) + Fork 계보(parent).
 * items 구조 예: `{ "items": [ { "id", "name", "imageUrl" } ] }` (imageUrl은 추후 R2 등 스토리지 URL)
 */
@Entity
@Table(name = "tier_templates")
class TierTemplate(
    title: String,
    itemsPayload: Map<String, Any?>,
    version: Int = 1,
    parentTemplate: TierTemplate? = null,
    creatorId: Long? = null,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    var id: UUID? = null
        protected set

    @Column(nullable = false, length = 500)
    var title: String = title
        protected set

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    var items: Map<String, Any?> = itemsPayload
        protected set

    @Column(nullable = false)
    var version: Int = version
        protected set

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_template_id")
    var parent: TierTemplate? = parentTemplate
        protected set

    @Column(name = "creator_id")
    var creatorId: Long? = creatorId
        protected set

    /** 카드 썸네일용 공개 이미지 URL 최대 4개 — jsonb (구 행은 null 가능) */
    @Access(AccessType.FIELD)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "thumbnail_urls", columnDefinition = "jsonb")
    var thumbnailUrls: List<String>? = null

    /**
     * `true`: 목록 카드는 `thumbnail_urls`의 **첫 URL만** 커스텀 커버로 사용.
     * `false`: `thumbnail_urls`는 아이템에서 고른 그리드용(최대 4)·비어 있으면 API가 items에서 보완.
     */
    @Column(name = "list_thumbnail_uses_custom", nullable = false)
    var listThumbnailUsesCustom: Boolean = false

    fun updateItems(newItems: Map<String, Any?>) {
        this.items = newItems
    }
}
