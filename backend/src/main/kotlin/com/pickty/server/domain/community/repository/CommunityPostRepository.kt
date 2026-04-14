package com.pickty.server.domain.community.repository

import com.pickty.server.domain.community.entity.CommunityPost
import com.pickty.server.domain.community.enums.CommunityPostStatus
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface CommunityPostRepository : JpaRepository<CommunityPost, UUID> {
    fun findAllByStatusOrderByCreatedAtDesc(status: CommunityPostStatus, pageable: Pageable): Page<CommunityPost>

    fun findByIdAndStatus(id: UUID, status: CommunityPostStatus): CommunityPost?

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE community_posts
        SET comment_count = comment_count + 1,
            updated_at = now()
        WHERE id = :id AND status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun incrementCommentCount(
        @Param("id") id: UUID,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE community_posts
        SET comment_count = GREATEST(0, comment_count - 1),
            updated_at = now()
        WHERE id = :id AND status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun decrementCommentCount(
        @Param("id") id: UUID,
    ): Int
}