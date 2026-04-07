package com.pickty.server.domain.board

import java.util.UUID
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

interface BoardPostRepository : JpaRepository<BoardPost, UUID> {
    fun findAllByStatusOrderByCreatedAtDesc(status: BoardPostStatus, pageable: Pageable): Page<BoardPost>

    fun findByIdAndStatus(id: UUID, status: BoardPostStatus): BoardPost?

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE board_posts
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
        UPDATE board_posts
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
