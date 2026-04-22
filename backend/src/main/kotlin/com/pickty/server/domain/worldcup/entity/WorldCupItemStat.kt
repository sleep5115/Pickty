package com.pickty.server.domain.worldcup.entity

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
import jakarta.persistence.UniqueConstraint
import java.util.UUID

@Entity
@Table(
    name = "worldcup_item_stats",
    uniqueConstraints = [
        UniqueConstraint(name = "uq_worldcup_item_stats_tpl_item", columnNames = ["template_id", "item_id"]),
    ],
)
class WorldCupItemStat(
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    var template: WorldCupTemplate,
    @Column(name = "item_id", nullable = false, length = 512)
    var itemId: String,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null

    @Column(name = "final_win_count", nullable = false)
    var finalWinCount: Long = 0

    @Column(name = "match_count", nullable = false)
    var matchCount: Long = 0

    @Column(name = "win_count", nullable = false)
    var winCount: Long = 0

    @Column(name = "rerolled_count", nullable = false)
    var rerolledCount: Long = 0

    @Column(name = "dropped_count", nullable = false)
    var droppedCount: Long = 0

    @Column(name = "kept_both_count", nullable = false)
    var keptBothCount: Long = 0
}
