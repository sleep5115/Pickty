package com.pickty.server.domain.community

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CommentRepository : JpaRepository<Comment, UUID> {
    fun findAllByTargetTypeAndTargetIdAndCommentStatusOrderByCreatedAtAsc(
        targetType: ReactionTargetType,
        targetId: UUID,
        commentStatus: CommentStatus,
    ): List<Comment>

    fun findAllByTargetTypeAndTargetIdAndCommentStatusOrderByCreatedAtAsc(
        targetType: ReactionTargetType,
        targetId: UUID,
        commentStatus: CommentStatus,
        pageable: Pageable,
    ): Page<Comment>
}
