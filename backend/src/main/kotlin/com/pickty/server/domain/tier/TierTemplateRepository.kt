package com.pickty.server.domain.tier

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TierTemplateRepository : JpaRepository<TierTemplate, UUID> {

    fun findAllByTemplateStatusOrderByCreatedAtDesc(templateStatus: TemplateStatus): List<TierTemplate>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE TierTemplate t SET t.creatorId = :newId WHERE t.creatorId = :oldId")
    fun migrateCreatorId(
        @Param("oldId") oldId: Long,
        @Param("newId") newId: Long,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_templates
        SET like_count = GREATEST(0, like_count + :delta),
            updated_at = now()
        WHERE id = :id AND template_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun adjustLikeCount(
        @Param("id") id: UUID,
        @Param("delta") delta: Long,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_templates
        SET comment_count = comment_count + 1,
            updated_at = now()
        WHERE id = :id AND template_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun incrementCommentCount(
        @Param("id") id: UUID,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_templates
        SET comment_count = GREATEST(0, comment_count - 1),
            updated_at = now()
        WHERE id = :id AND template_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun decrementCommentCount(
        @Param("id") id: UUID,
    ): Int
}
