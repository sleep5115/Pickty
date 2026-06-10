package com.pickty.server.domain.profile.entity

import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table

/**
 * 게임인생프로필 — 프로필 1개 = 게임 카드 N개 + 현실 피드 N개를 묶는 애그리거트 루트.
 *
 * 신문지 격자형 단일 명함 컨셉으로 닉네임·한줄소개·아바타는 스펙아웃(외부에서 이미 닉네임이 드러난 채
 * 공유되므로 중복 표시명 배제). 프로필의 식별/표시는 [customSlug] 하나로 한다.
 *
 * - 회원: [userId] 매핑(소유권은 user_id 일치로 판별)
 * - 비회원: [userId] = null, [customSlug](주소 ID) + [guestPasswordHash](암구호)로 선점·수정 권한 검증
 */
@Entity
@Table(
    name = "gamer_profiles",
    indexes = [
        Index(name = "idx_gamer_profiles_user_id", columnList = "user_id"),
        Index(name = "idx_gamer_profiles_custom_slug", columnList = "custom_slug"),
    ],
)
class GamerProfile(
    customSlug: String,
    userId: Long? = null,
    guestPasswordHash: String? = null,
    guestIpHash: String? = null,
) : BaseTimeEntity() {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "user_id")
    var userId: Long? = userId
        protected set

    @Column(name = "custom_slug", nullable = false, unique = true, length = 50)
    var customSlug: String = customSlug
        protected set

    @Column(name = "guest_password_hash", length = 64)
    var guestPasswordHash: String? = guestPasswordHash
        protected set

    @Column(name = "guest_ip_hash", length = 64)
    var guestIpHash: String? = guestIpHash
        protected set

    @OneToMany(mappedBy = "profile", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private val _cards: MutableList<GamerProfileCard> = mutableListOf()

    val cards: List<GamerProfileCard>
        get() = _cards.toList()

    @OneToMany(mappedBy = "profile", cascade = [CascadeType.ALL], orphanRemoval = true)
    @OrderBy("displayOrder ASC, id ASC")
    private val _feeds: MutableList<GamerProfileFeed> = mutableListOf()

    val feeds: List<GamerProfileFeed>
        get() = _feeds.toList()

    val isGuest: Boolean
        get() = userId == null

    fun replaceCards(newCards: List<GamerProfileCard>) {
        _cards.clear()
        newCards.forEach { card ->
            card.attachTo(this)
            _cards.add(card)
        }
    }

    fun replaceFeeds(newFeeds: List<GamerProfileFeed>) {
        _feeds.clear()
        newFeeds.forEach { feed ->
            feed.attachTo(this)
            _feeds.add(feed)
        }
    }
}
