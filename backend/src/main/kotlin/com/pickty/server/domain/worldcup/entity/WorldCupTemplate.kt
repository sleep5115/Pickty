package com.pickty.server.domain.worldcup.entity

import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.ColumnDefault
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.util.UUID

/**
 * 이상형 월드컵 템플릿 — 아이템 정의(JSON 배열) + 메타.
 */
@Entity
@Table(name = "worldcup_templates")
class WorldCupTemplate(
    title: String,
    description: String?,
    itemsPayload: List<Map<String, Any?>>,
    version: Int = 1,
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

    @Column(columnDefinition = "text")
    var description: String? = description
        protected set

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    var items: List<Map<String, Any?>> = itemsPayload
        protected set

    @Column(nullable = false)
    var version: Int = version
        protected set

    @Column(name = "creator_id")
    var creatorId: Long? = creatorId
        protected set

    @Column(name = "thumbnail_url", length = 2048)
    var thumbnailUrl: String? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "template_status", nullable = false, length = 20)
    @ColumnDefault("'ACTIVE'")
    var templateStatus: TemplateStatus = TemplateStatus.ACTIVE

    @Column(name = "layout_mode", nullable = false, length = 32)
    @ColumnDefault("'split_diagonal'")
    var layoutMode: String = "split_diagonal"

    @Column(name = "like_count", nullable = false)
    @ColumnDefault("0")
    var likeCount: Long = 0

    @Column(name = "comment_count", nullable = false)
    @ColumnDefault("0")
    var commentCount: Long = 0

    @Column(name = "view_count", nullable = false)
    @ColumnDefault("0")
    var viewCount: Long = 0

    fun applyMeta(newTitle: String, newDescription: String?, newLayoutMode: String? = null) {
        title = newTitle.trim()
        description = newDescription?.trim()?.takeIf { it.isNotEmpty() }
        if (newLayoutMode != null) {
            layoutMode = newLayoutMode
        }
        version = version + 1
    }

    fun markDeleted() {
        templateStatus = TemplateStatus.DELETED
    }
}
