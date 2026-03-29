package com.pickty.server.domain.tier

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface TierTemplateRepository : JpaRepository<TierTemplate, UUID> {

    fun findAllByStatusOrderByCreatedAtDesc(status: TemplateStatus): List<TierTemplate>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE TierTemplate t SET t.creatorId = :newId WHERE t.creatorId = :oldId")
    fun migrateCreatorId(
        @Param("oldId") oldId: Long,
        @Param("newId") newId: Long,
    ): Int
}
