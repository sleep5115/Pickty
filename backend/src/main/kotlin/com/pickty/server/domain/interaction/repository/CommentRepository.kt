package com.pickty.server.domain.interaction.repository

import com.pickty.server.domain.interaction.entity.Comment
import com.pickty.server.domain.interaction.enums.CommentStatus
import com.pickty.server.domain.interaction.enums.ReactionTargetType
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
