package com.pickty.server.domain.worldcup.repository

import com.pickty.server.domain.worldcup.entity.WorldCupItemStat
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface WorldCupItemStatRepository : JpaRepository<WorldCupItemStat, Long> {

    fun findAllByTemplate_Id(templateId: UUID): List<WorldCupItemStat>

    /**
     * 카운트 누적 upsert — 동일 (template_id, item_id) 행에 델타를 더한다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value =
            """
            INSERT INTO worldcup_item_stats (
                template_id, item_id,
                match_count, win_count, rerolled_count, dropped_count, kept_both_count, final_win_count,
                created_at, updated_at
            ) VALUES (
                :templateId, :itemId,
                :dMatch, :dWin, :dReroll, :dDrop, :dKeep, :dFinal,
                now(), now()
            )
            ON CONFLICT (template_id, item_id) DO UPDATE SET
                match_count = worldcup_item_stats.match_count + EXCLUDED.match_count,
                win_count = worldcup_item_stats.win_count + EXCLUDED.win_count,
                rerolled_count = worldcup_item_stats.rerolled_count + EXCLUDED.rerolled_count,
                dropped_count = worldcup_item_stats.dropped_count + EXCLUDED.dropped_count,
                kept_both_count = worldcup_item_stats.kept_both_count + EXCLUDED.kept_both_count,
                final_win_count = worldcup_item_stats.final_win_count + EXCLUDED.final_win_count,
                updated_at = now()
            """,
        nativeQuery = true,
    )
    fun upsertIncrement(
        @Param("templateId") templateId: UUID,
        @Param("itemId") itemId: String,
        @Param("dMatch") dMatch: Long,
        @Param("dWin") dWin: Long,
        @Param("dReroll") dReroll: Long,
        @Param("dDrop") dDrop: Long,
        @Param("dKeep") dKeep: Long,
        @Param("dFinal") dFinal: Long,
    ): Int
}
