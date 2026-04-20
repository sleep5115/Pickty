package com.pickty.server.domain.worldcup.service

import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.dto.WorldCupItemStatPayload
import com.pickty.server.domain.worldcup.dto.WorldCupRankingRowResponse
import com.pickty.server.domain.worldcup.dto.WorldCupResultSubmitRequest
import com.pickty.server.domain.worldcup.repository.WorldCupItemStatRepository
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID
import kotlin.math.roundToInt

@Service
class WorldCupStatService(
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    private val worldCupItemStatRepository: WorldCupItemStatRepository,
) {

    @Transactional
    fun submitPlayResult(templateId: UUID, body: WorldCupResultSubmitRequest) {
        val winnerItemId = body.winnerItemId.trim()
        if (winnerItemId.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "winnerItemId 가 필요합니다.")
        }

        val tpl =
            worldCupTemplateRepository.findById(templateId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
        if (tpl.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }

        for ((rawItemId, payload) in body.itemStats) {
            val itemId = rawItemId.trim()
            if (itemId.isEmpty()) continue
            applyDelta(templateId, itemId, payload)
        }

        val rows =
            worldCupItemStatRepository.upsertIncrement(
                templateId,
                winnerItemId,
                dMatch = 0,
                dWin = 0,
                dReroll = 0,
                dDrop = 0,
                dKeep = 0,
                dFinal = 1,
            )
        if (rows <= 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "통계 반영에 실패했습니다.")
        }
    }

    private fun applyDelta(templateId: UUID, itemId: String, p: WorldCupItemStatPayload) {
        val rows =
            worldCupItemStatRepository.upsertIncrement(
                templateId,
                itemId,
                dMatch = coerceNonNegative(p.matchCount),
                dWin = coerceNonNegative(p.winCount),
                dReroll = coerceNonNegative(p.rerolledCount),
                dDrop = coerceNonNegative(p.droppedCount),
                dKeep = coerceNonNegative(p.keptBothCount),
                dFinal = 0,
            )
        if (rows <= 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "통계 반영에 실패했습니다.")
        }
    }

    @Transactional(readOnly = true)
    fun ranking(templateId: UUID): List<WorldCupRankingRowResponse> {
        val tpl =
            worldCupTemplateRepository.findById(templateId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
        if (tpl.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }

        val stats = worldCupItemStatRepository.findAllByTemplate_Id(templateId)
        val totalGames = stats.sumOf { it.finalWinCount }.coerceAtLeast(0)

        val rows =
            stats
                .map { row ->
                    val mc = row.matchCount
                    WorldCupRankingRowResponse(
                        rank = 0,
                        itemId = row.itemId,
                        matchCount = mc,
                        winCount = row.winCount,
                        rerolledCount = row.rerolledCount,
                        droppedCount = row.droppedCount,
                        keptBothCount = row.keptBothCount,
                        finalWinCount = row.finalWinCount,
                        winRatePct = pct(row.winCount, mc),
                        championshipRatePct = pct(row.finalWinCount, totalGames),
                        skipRatePct = pct(row.rerolledCount, mc),
                        dropRatePct = pct(row.droppedCount, mc),
                        nailBiterRatePct = pct(row.keptBothCount, mc),
                    )
                }.sortedWith(
                    compareByDescending<WorldCupRankingRowResponse> { it.finalWinCount }
                        .thenByDescending { it.winRatePct }
                        .thenBy { it.itemId },
                )

        return rows.mapIndexed { i, r -> r.copy(rank = i + 1) }
    }

    private fun coerceNonNegative(v: Long): Long = if (v < 0) 0 else v

    private fun pct(numerator: Long, denominator: Long): Int {
        if (denominator <= 0L) return 0
        val v = (numerator.toDouble() / denominator.toDouble()) * 100.0
        return v.roundToInt().coerceIn(0, 100)
    }
}
