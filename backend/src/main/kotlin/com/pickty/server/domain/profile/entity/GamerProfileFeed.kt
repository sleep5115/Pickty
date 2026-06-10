package com.pickty.server.domain.profile.entity

import com.pickty.server.domain.profile.enums.GamerProfileFeedType
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
import jakarta.persistence.Table
import java.time.LocalDateTime

/** 프로필 하단의 자유 갤러리 피드 — 데스크셋업·장비·굿즈 등 현실 감성 사진 및 자율인증 스크린샷. */
@Entity
@Table(
    name = "gamer_profile_feeds",
    indexes = [
        Index(name = "idx_gamer_profile_feeds_profile_id", columnList = "profile_id"),
    ],
)
class GamerProfileFeed(
    imageUrl: String,
    description: String? = null,
    feedType: GamerProfileFeedType = GamerProfileFeedType.REALITY,
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

    @Column(name = "image_url", nullable = false, length = 255)
    var imageUrl: String = imageUrl
        protected set

    @Column(length = 255)
    var description: String? = description
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "feed_type", nullable = false, length = 20)
    var feedType: GamerProfileFeedType = feedType
        protected set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        protected set

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()
        protected set

    fun attachTo(profile: GamerProfile) {
        this.profile = profile
    }
}

