package com.pickty.server.domain.tier.repository

import com.pickty.server.domain.tier.enums.ResultStatus
import com.pickty.server.domain.tier.entity.TierResult
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TierResultRepository : JpaRepository<TierResult, UUID> {

    @Query("SELECT r.viewCount FROM TierResult r WHERE r.id = :id")
    fun findViewCountById(@Param("id") id: UUID): Long?

    fun countByTemplate_IdAndResultStatus(templateId: UUID, resultStatus: ResultStatus): Long

    @Query(
        """
        SELECT r FROM TierResult r
        JOIN FETCH r.template t
        WHERE r.id = :id
        """,
    )
    fun findByIdWithTemplate(@Param("id") id: UUID): TierResult?

    @Query(
        """
        SELECT r FROM TierResult r
        JOIN FETCH r.template t
        WHERE r.userId = :userId AND r.resultStatus = :resultStatus
        ORDER BY r.createdAt DESC
        """,
    )
    fun findByUserIdAndResultStatusWithTemplateOrderByCreatedAtDesc(
        @Param("userId") userId: Long,
        @Param("resultStatus") resultStatus: ResultStatus,
    ): List<TierResult>

    @EntityGraph(attributePaths = ["template"])
    fun findAllByResultStatusOrderByCreatedAtDesc(resultStatus: ResultStatus, pageable: Pageable): Page<TierResult>

    /** 템플릿별 활성 결과 — 추천 수(up_count) 내림차순, 동점 시 최신순. 정렬은 pageable에 위임 */
    @EntityGraph(attributePaths = ["template"])
    @Query(
        """
        SELECT r FROM TierResult r
        WHERE r.template.id = :templateId AND r.resultStatus = :resultStatus
        """,
    )
    fun findPopularByTemplateId(
        @Param("templateId") templateId: UUID,
        @Param("resultStatus") resultStatus: ResultStatus,
        pageable: Pageable,
    ): List<TierResult>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE TierResult r SET r.userId = :newId WHERE r.userId = :oldId")
    fun migrateUserId(
        @Param("oldId") oldId: Long,
        @Param("newId") newId: Long,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_results
        SET up_count = GREATEST(0, up_count + :dUp),
            down_count = GREATEST(0, down_count + :dDown),
            updated_at = now()
        WHERE id = :id AND result_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun adjustVoteCounts(
        @Param("id") id: UUID,
        @Param("dUp") dUp: Long,
        @Param("dDown") dDown: Long,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_results
        SET comment_count = comment_count + 1,
            updated_at = now()
        WHERE id = :id AND result_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun incrementCommentCount(
        @Param("id") id: UUID,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        UPDATE tier_results
        SET comment_count = GREATEST(0, comment_count - 1),
            updated_at = now()
        WHERE id = :id AND result_status = 'ACTIVE'
        """,
        nativeQuery = true,
    )
    fun decrementCommentCount(
        @Param("id") id: UUID,
    ): Int
}
