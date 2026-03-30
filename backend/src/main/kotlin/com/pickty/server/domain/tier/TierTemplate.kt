package com.pickty.server.domain.tier

import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.ColumnDefault
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

    @Column(nullable = false, length = 100)
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

    @Enumerated(EnumType.STRING)
    @Column(name = "template_status", nullable = false, length = 20)
    @ColumnDefault("'ACTIVE'")
    var templateStatus: TemplateStatus = TemplateStatus.ACTIVE

    @Column(name = "like_count", nullable = false)
    @ColumnDefault("0")
    var likeCount: Long = 0

    @Column(name = "comment_count", nullable = false)
    @ColumnDefault("0")
    var commentCount: Long = 0

    fun updateItems(newItems: Map<String, Any?>) {
        this.items = newItems
    }

    /** 제목 + JSONB `description` 키만 갱신(아이템 배열 불변) */
    fun applyTemplateMeta(newTitle: String, newDescription: String?) {
        title = newTitle
        val m = items.toMutableMap()
        val d = newDescription?.trim()?.takeIf { it.isNotEmpty() }
        if (d == null) {
            m.remove("description")
        } else {
            m["description"] = d
        }
        items = m
        version = version + 1
    }

    fun markDeleted() {
        templateStatus = TemplateStatus.DELETED
    }
}
