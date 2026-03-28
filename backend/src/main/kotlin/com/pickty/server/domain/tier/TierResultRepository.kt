package com.pickty.server.domain.tier

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.EntityGraph
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TierResultRepository : JpaRepository<TierResult, UUID> {

    fun countByTemplate_Id(templateId: UUID): Long

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
        WHERE r.userId = :userId
        ORDER BY r.createdAt DESC
        """,
    )
    fun findByUserIdWithTemplateOrderByCreatedAtDesc(@Param("userId") userId: Long): List<TierResult>

    @EntityGraph(attributePaths = ["template"])
    fun findAllByOrderByCreatedAtDesc(pageable: Pageable): Page<TierResult>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE TierResult r SET r.userId = :newId WHERE r.userId = :oldId")
    fun migrateUserId(
        @Param("oldId") oldId: Long,
        @Param("newId") newId: Long,
    ): Int
}
