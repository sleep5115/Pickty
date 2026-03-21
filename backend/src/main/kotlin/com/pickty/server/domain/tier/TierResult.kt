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
 * 유저(또는 익명)의 티어 배치 스냅샷.
 * - isTemporary: 익명 제출 등 휘발성 — 추후 TTL/배치 삭제 대상
 * - snapshotData: `{ "schemaVersion": 1, "tiers": [...], "pool": [...] }`
 */
@Entity
@Table(name = "tier_results")
class TierResult(
    templateEntity: TierTemplate,
    snapshotPayload: Map<String, Any?>,
    userIdInit: Long? = null,
    isPublicInit: Boolean = false,
    isTemporaryInit: Boolean = true,
    listTitleInit: String? = null,
    listDescriptionInit: String? = null,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    var id: UUID? = null
        protected set

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    var template: TierTemplate = templateEntity
        protected set

    @Column(name = "user_id")
    var userId: Long? = userIdInit
        protected set

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "snapshot_data", columnDefinition = "jsonb", nullable = false)
    var snapshotData: Map<String, Any?> = snapshotPayload
        protected set

    @Column(name = "is_public", nullable = false)
    var isPublic: Boolean = isPublicInit
        protected set

    @Column(name = "is_temporary", nullable = false)
    var isTemporary: Boolean = isTemporaryInit
        protected set

    /** 유저가 붙인 티어표 제목 (TierMaker의 Title of Tier List) */
    @Column(name = "list_title", length = 500)
    var listTitle: String? = listTitleInit
        protected set

    @Column(name = "list_description", columnDefinition = "text")
    var listDescription: String? = listDescriptionInit
        protected set

    fun attachUser(userId: Long) {
        this.userId = userId
        this.isTemporary = false
    }
}
