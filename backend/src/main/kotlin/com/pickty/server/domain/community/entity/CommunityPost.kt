package com.pickty.server.domain.community.entity

import com.pickty.server.domain.community.enums.CommunityPostStatus
import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import org.hibernate.annotations.ColumnDefault
import java.util.UUID

@Entity
@Table(
    name = "community_posts",
    indexes = [
        Index(name = "ix_community_posts_status_created_at", columnList = "status,created_at"),
        Index(name = "ix_community_posts_author_id", columnList = "author_id"),
    ],
)
class CommunityPost(
    title: String,
    contentHtml: String,
    authorId: Long? = null,
    guestNickname: String? = null,
    guestPasswordHash: String? = null,
    guestIpHash: String? = null,
    guestIpPrefix: String? = null,
) : BaseTimeEntity() {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    var id: UUID? = null
        protected set

    @Column(nullable = false, length = 200)
    var title: String = title
        protected set

    @Column(name = "content_html", nullable = false, columnDefinition = "text")
    var contentHtml: String = contentHtml
        protected set

    @Column(name = "author_id")
    var authorId: Long? = authorId
        protected set

    @Column(name = "guest_nickname", length = 64)
    var guestNickname: String? = guestNickname
        protected set

    @Column(name = "guest_password_hash", length = 255)
    var guestPasswordHash: String? = guestPasswordHash
        protected set

    @Column(name = "guest_ip_hash", length = 64)
    var guestIpHash: String? = guestIpHash
        protected set

    @Column(name = "guest_ip_prefix", length = 45)
    var guestIpPrefix: String? = guestIpPrefix
        protected set

    @Column(name = "view_count", nullable = false)
    @ColumnDefault("0")
    var viewCount: Long = 0
        protected set

    @Column(name = "comment_count", nullable = false)
    @ColumnDefault("0")
    var commentCount: Long = 0
        protected set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ColumnDefault("'ACTIVE'")
    var status: CommunityPostStatus = CommunityPostStatus.ACTIVE
        protected set

    fun incrementViewCount() {
        viewCount += 1
    }

    fun applyTitleAndHtml(newTitle: String, newContentHtml: String) {
        title = newTitle
        contentHtml = newContentHtml
    }

    fun markDeleted() {
        status = CommunityPostStatus.DELETED
    }
}