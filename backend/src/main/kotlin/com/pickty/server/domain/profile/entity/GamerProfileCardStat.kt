package com.pickty.server.domain.profile.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

/** 게임 카드 하위의 레고식 Key-Value 스탯 슬롯 (예: 최고티어 = 다이아몬드4). */
@Entity
@Table(
    name = "gamer_profile_card_stats",
    indexes = [
        Index(name = "idx_gamer_profile_card_stats_card_id", columnList = "card_id"),
    ],
)
class GamerProfileCardStat(
    statKey: String,
    statValue: String,
    displayOrder: Int = 0,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "card_id", nullable = false)
    var card: GamerProfileCard? = null
        protected set

    @Column(name = "stat_key", nullable = false, length = 100)
    var statKey: String = statKey
        protected set

    @Column(name = "stat_value", nullable = false, length = 100)
    var statValue: String = statValue
        protected set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        protected set

    fun attachTo(card: GamerProfileCard) {
        this.card = card
    }
}
