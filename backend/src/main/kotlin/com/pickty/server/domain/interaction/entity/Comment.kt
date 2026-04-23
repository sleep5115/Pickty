package com.pickty.server.domain.interaction.entity

import com.pickty.server.domain.interaction.enums.CommentStatus
import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.global.common.BaseTimeEntity
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
import java.util.UUID

/**
 * 다형성 댓글. [targetId] 에 DB FK 없음.
 * 비회원: [userId] null + [authorName]·[guestPassword]·[guestIpHash] 필수(DB CHECK).
 * [authorIpPrefix] 는 비회원 표시용(앞 두 옥텟 등), 회원이면 null.
 */
@Entity
@Table(
    name = "comments",
    indexes = [
        Index(name = "ix_comments_target", columnList = "target_type,target_id"),
        Index(name = "ix_comments_parent", columnList = "parent_comment_id"),
    ],
)
class Comment(
    targetType: ReactionTargetType,
    targetId: UUID,
    body: String,
    userId: Long? = null,
    parent: Comment? = null,
    authorName: String? = null,
    authorIpPrefix: String? = null,
    guestPassword: String? = null,
    guestIpHash: String? = null,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    var id: UUID? = null
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 32)
    var targetType: ReactionTargetType = targetType
        protected set

    @Column(name = "target_id", nullable = false, columnDefinition = "uuid")
    var targetId: UUID = targetId
        protected set

    @Column(name = "user_id")
    var userId: Long? = userId
        protected set

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_comment_id")
    var parent: Comment? = parent
        protected set

    @Column(nullable = false, columnDefinition = "text")
    var body: String = body
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "comment_status", nullable = false, length = 16)
    var commentStatus: CommentStatus = CommentStatus.ACTIVE
        protected set

    @Column(name = "author_name", length = 64)
    var authorName: String? = authorName
        protected set

    @Column(name = "author_ip_prefix", length = 45)
    var authorIpPrefix: String? = authorIpPrefix
        protected set

    @Column(name = "guest_password", length = 255)
    var guestPassword: String? = guestPassword
        protected set

    @Column(name = "guest_ip_hash", length = 64)
    var guestIpHash: String? = guestIpHash
        protected set

    fun markDeleted() {
        commentStatus = CommentStatus.DELETED
    }
}
