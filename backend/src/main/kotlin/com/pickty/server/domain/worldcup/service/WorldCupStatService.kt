package com.pickty.server.domain.worldcup.service

import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.dto.WorldCupRankingPageResponse
import com.pickty.server.domain.worldcup.dto.WorldCupRankingRowResponse
import com.pickty.server.domain.worldcup.dto.WorldCupResultSubmitRequest
import com.pickty.server.domain.worldcup.dto.WorldCupStatSubmitRow
import com.pickty.server.domain.worldcup.entity.WorldCupItemStat
import com.pickty.server.domain.worldcup.repository.WorldCupItemStatRepository
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import org.springframework.data.domain.Pageable
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
        if (body.winnerItemId <= 0L) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "winnerItemId 가 필요합니다.")
        }
        val startBracket = body.startBracket.toInt().coerceIn(2, 4096)
        if (!isPowerOfTwo(startBracket)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "startBracket 는 2의 거듭제곱(2,4,8,16,…)이어야 합니다.")
        }

        val tpl =
            worldCupTemplateRepository.findById(templateId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
        if (tpl.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }

        for (row in body.rows) {
            applyStatRow(templateId, row, startBracket)
        }

        val rows =
            worldCupItemStatRepository.upsertIncrement(
                templateId,
                body.winnerItemId,
                dMatch = 0,
                dWin = 0,
                dReroll = 0,
                dDrop = 0,
                dKeep = 0,
                dFinal = 1,
                dR16 = 0,
                dR8 = 0,
                dR4 = 0,
                dRf = 0,
            )
        if (rows <= 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "통계 반영에 실패했습니다.")
        }
    }

    private fun applyStatRow(templateId: UUID, row: WorldCupStatSubmitRow, startBracket: Int) {
        val itemId = row.itemId
        if (itemId <= 0L) return
        val rd = reachedDeltas(row.peakBracketSize, startBracket)
        val r =
            worldCupItemStatRepository.upsertIncrement(
                templateId,
                itemId,
                dMatch = coerceNonNegative(row.matchCount),
                dWin = coerceNonNegative(row.winCount),
                dReroll = coerceNonNegative(row.rerolledCount),
                dDrop = coerceNonNegative(row.droppedCount),
                dKeep = coerceNonNegative(row.keptBothCount),
                dFinal = 0,
                dR16 = rd[0],
                dR8 = rd[1],
                dR4 = rd[2],
                dRf = rd[3],
            )
        if (r <= 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "통계 반영에 실패했습니다.")
        }
    }

    /**
     * `peak` = 끝났을 때의 성과(1=우승,2=결승 패,4/8/16/32/…=해당 N강에서 탈락).
     * [r16, r8, r4, rf] — N강 **이상**으로 승리해 **진출**한 판에만 1(동일 판 1회).
     */
    private fun reachedDeltas(peak: Int, start: Int): LongArray {
        val s = start.coerceAtLeast(1)
        val p = peak.coerceAtLeast(0)
        val m16 = s >= 16 && p in setOf(1, 2, 4, 8, 16)
        val m8 = s >= 8 && p in setOf(1, 2, 4, 8)
        val m4 = s >= 4 && p in setOf(1, 2, 4)
        val m2 = s >= 2 && p in setOf(1, 2)
        return longArrayOf(
            if (m16) 1L else 0L,
            if (m8) 1L else 0L,
            if (m4) 1L else 0L,
            if (m2) 1L else 0L,
        )
    }

    private fun isPowerOfTwo(n: Int): Boolean = n > 0 && (n and (n - 1)) == 0

    @Transactional(readOnly = true)
    fun ranking(templateId: UUID, pageable: Pageable): WorldCupRankingPageResponse {
        val tpl =
            worldCupTemplateRepository.findById(templateId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
        if (tpl.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }

        val safePage = pageable.pageNumber.coerceAtLeast(0)
        val safeSize = pageable.pageSize.coerceIn(1, 100)

        val totalGames =
            worldCupItemStatRepository.sumFinalWinCountByTemplateId(templateId).coerceAtLeast(0L)

        val templateItemIds = parseTemplateItemIds(tpl.items)
        val statsByItemId =
            worldCupItemStatRepository.findAllByTemplate_Id(templateId).associateBy { it.itemId }

        val merged =
            templateItemIds.map { itemId ->
                snapshotFromStatOrEmpty(itemId, statsByItemId[itemId])
            }.sortedWith(
                compareByDescending<RankingStatSnapshot> { it.finalWinCount }
                    .thenByDescending { winRateSortKey(it.matchCount, it.winCount) }
                    .thenBy { it.itemId },
            )

        val totalElements = merged.size.toLong()
        val totalPages =
            if (totalElements == 0L) {
                0
            } else {
                ((totalElements + safeSize - 1) / safeSize).toInt()
            }
        val effPage =
            when {
                totalPages <= 0 -> 0
                safePage >= totalPages -> totalPages - 1
                else -> safePage
            }
        val fromIndex = effPage * safeSize
        val pageSlice = merged.drop(fromIndex).take(safeSize)
        val baseRank = fromIndex + 1

        val content =
            pageSlice.mapIndexed { index, row ->
                val mc = row.matchCount
                WorldCupRankingRowResponse(
                    rank = baseRank + index,
                    itemId = row.itemId,
                    matchCount = mc,
                    winCount = row.winCount,
                    rerolledCount = row.rerolledCount,
                    droppedCount = row.droppedCount,
                    keptBothCount = row.keptBothCount,
                    finalWinCount = row.finalWinCount,
                    reached16Count = row.reached16Count,
                    reached8Count = row.reached8Count,
                    reached4Count = row.reached4Count,
                    reachedFinalCount = row.reachedFinalCount,
                    winRatePct = pct(row.winCount, mc),
                    championshipRatePct = pct(row.finalWinCount, totalGames),
                    skipRatePct = pct(row.rerolledCount, mc),
                    dropRatePct = pct(row.droppedCount, mc),
                    nailBiterRatePct = pct(row.keptBothCount, mc),
                )
            }

        return WorldCupRankingPageResponse(
            totalCompletedPlays = totalGames,
            content = content,
            totalElements = totalElements,
            totalPages = totalPages,
            size = safeSize,
            number = effPage,
            first = effPage == 0,
            last = totalPages == 0 || effPage >= totalPages - 1,
            empty = content.isEmpty(),
        )
    }

    /** 템플릿 JSON `items` 안의 `id` 를 앞에서부터(중복 제거) */
    private fun parseTemplateItemIds(items: List<Map<String, Any?>>): List<Long> {
        val out = ArrayList<Long>()
        val seen = HashSet<Long>()
        for (m in items) {
            val id = parseItemIdFromMap(m) ?: continue
            if (id <= 0L) continue
            if (seen.add(id)) {
                out.add(id)
            }
        }
        return out
    }

    private fun parseItemIdFromMap(m: Map<String, Any?>): Long? {
        val v = m["id"] ?: return null
        return when (v) {
            is Number -> v.toLong().takeIf { it > 0L }
            is String -> v.trim().toLongOrNull()?.takeIf { it > 0L }
            else -> null
        }
    }

    private fun snapshotFromStatOrEmpty(itemId: Long, stat: WorldCupItemStat?): RankingStatSnapshot {
        if (stat == null) {
            return RankingStatSnapshot(itemId = itemId)
        }
        return RankingStatSnapshot(
            itemId = stat.itemId,
            matchCount = stat.matchCount,
            winCount = stat.winCount,
            rerolledCount = stat.rerolledCount,
            droppedCount = stat.droppedCount,
            keptBothCount = stat.keptBothCount,
            finalWinCount = stat.finalWinCount,
            reached16Count = stat.reached16Count,
            reached8Count = stat.reached8Count,
            reached4Count = stat.reached4Count,
            reachedFinalCount = stat.reachedFinalCount,
        )
    }

    /** native 랭킹 쿼리의 `CASE WHEN match_count <= 0 THEN 0 ELSE ROUND(win/match*100) END` 와 동일 키 */
    private fun winRateSortKey(matchCount: Long, winCount: Long): Int {
        if (matchCount <= 0L) return 0
        val v = (winCount.toDouble() / matchCount.toDouble()) * 100.0
        return v.roundToInt().coerceIn(0, 100)
    }

    private data class RankingStatSnapshot(
        val itemId: Long,
        val matchCount: Long = 0L,
        val winCount: Long = 0L,
        val rerolledCount: Long = 0L,
        val droppedCount: Long = 0L,
        val keptBothCount: Long = 0L,
        val finalWinCount: Long = 0L,
        val reached16Count: Long = 0L,
        val reached8Count: Long = 0L,
        val reached4Count: Long = 0L,
        val reachedFinalCount: Long = 0L,
    )

    private fun coerceNonNegative(v: Long): Long = if (v < 0) 0 else v

    private fun pct(numerator: Long, denominator: Long): Int {
        if (denominator <= 0L) return 0
        val v = (numerator.toDouble() / denominator.toDouble()) * 100.0
        return v.roundToInt().coerceIn(0, 100)
    }
}
