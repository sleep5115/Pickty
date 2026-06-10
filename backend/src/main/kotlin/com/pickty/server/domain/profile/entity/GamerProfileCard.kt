package com.pickty.server.domain.profile.entity

import com.pickty.server.domain.profile.enums.GameSource
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 프로필에 속한 개별 게임 카드. 하위에 Key-Value 스탯을 N개 가진다. */
@Entity
@Table(
    name = "gamer_profile_cards",
    indexes = [
        Index(name = "idx_gamer_profile_cards_profile_id", columnList = "profile_id"),
        Index(name = "idx_gamer_profile_cards_game_slug", columnList = "game_slug"),
    ],
)
class GamerProfileCard(
    gameSlug: String,
    gameSource: GameSource,
    gameTitle: String,
    gameIconUrl: String? = null,
    externalApiIdentifier: String? = null,
    isMain: Boolean = false,
    displayOrder: Int = 0,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id", nullable = false)
    var profile: GamerProfile? = null
        protected set

    @Column(name = "game_slug", nullable = false, length = 100)
    var gameSlug: String = gameSlug
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "game_source", nullable = false, length = 20)
    var gameSource: GameSource = gameSource
        protected set

    @Column(name = "game_title", nullable = false, length = 100)
    var gameTitle: String = gameTitle
        protected set

    @Column(name = "game_icon_url", length = 255)
    var gameIconUrl: String? = gameIconUrl
        protected set

    @Column(name = "external_api_identifier", length = 100)
    var externalApiIdentifier: String? = externalApiIdentifier
        protected set

    @Column(name = "is_main", nullable = false)
    var isMain: Boolean = isMain
        protected set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        protected set

    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
        protected set

    @OneToMany(mappedBy = "card", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private val _stats: MutableList<GamerProfileCardStat> = mutableListOf()

    val stats: List<GamerProfileCardStat>
        get() = _stats.toList()

    fun attachTo(profile: GamerProfile) {
        this.profile = profile
    }

    fun replaceStats(newStats: List<GamerProfileCardStat>) {
        _stats.clear()
        newStats.forEach { stat ->
            stat.attachTo(this)
            _stats.add(stat)
        }
    }
}

