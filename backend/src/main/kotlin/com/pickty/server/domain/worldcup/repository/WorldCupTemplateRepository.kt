package com.pickty.server.domain.worldcup.repository

import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.entity.WorldCupTemplate
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface WorldCupTemplateRepository : JpaRepository<WorldCupTemplate, UUID> {

    fun findAllByTemplateStatusOrderByCreatedAtDesc(templateStatus: TemplateStatus): List<WorldCupTemplate>

    fun findAllByCreatorIdAndTemplateStatusOrderByCreatedAtDesc(
        creatorId: Long,
        templateStatus: TemplateStatus,
    ): List<WorldCupTemplate>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value =
            """
            UPDATE worldcup_templates
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
        value =
            """
            UPDATE worldcup_templates
            SET comment_count = comment_count + 1,
                updated_at = now()
            WHERE id = :id AND template_status = 'ACTIVE'
            """,
        nativeQuery = true,
    )
    fun incrementCommentCount(@Param("id") id: UUID): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value =
            """
            UPDATE worldcup_templates
            SET comment_count = GREATEST(0, comment_count - 1),
                updated_at = now()
            WHERE id = :id AND template_status = 'ACTIVE'
            """,
        nativeQuery = true,
    )
    fun decrementCommentCount(@Param("id") id: UUID): Int
}
