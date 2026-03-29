package com.pickty.server.domain.tier

import com.pickty.server.global.common.BaseTimeEntity
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
 * 목록·OG용 썸네일은 **단일 URL**(프론트에서 2×2 합성 PNG 또는 커스텀 1장 업로드).
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

    /** 템플릿 카드·OG 이미지 — 단일 공개 https URL (정규화는 서비스에서 수행) */
    @Column(name = "thumbnail_url", length = 2048)
    var thumbnailUrl: String? = null

    fun updateItems(newItems: Map<String, Any?>) {
        this.items = newItems
    }

    /** 제목·JSONB·썸네일 일괄 갱신(저장 수정) — 버전만 1 증가 */
    fun replaceContent(newTitle: String, newItems: Map<String, Any?>, newThumbnailUrl: String?) {
        title = newTitle
        items = newItems
        thumbnailUrl = newThumbnailUrl
        version = version + 1
    }
}
