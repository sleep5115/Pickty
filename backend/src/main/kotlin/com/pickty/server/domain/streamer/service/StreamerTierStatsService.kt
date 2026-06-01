package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.dto.TierItemStat
import com.pickty.server.domain.streamer.dto.TierStatsResponse
import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.springframework.data.redis.core.ScanOptions
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 티어표 스트리머 모드 — 시청자 완성본 1인 1제출 집계.
 *
 * 행(row)이 템플릿마다 자유롭기에 고정 등급 대신 **rowIndex(0=최상단) 분포**만 카운트한다.
 * 배치(최빈값)·동률 판정은 행 순서를 아는 프론트가 분포를 보고 수행한다.
 */
@Service
class StreamerTierStatsService(
    private val redisTemplate: StringRedisTemplate,
    private val streamerTierSubmitScript: DefaultRedisScript<Long>,
) {

    /**
     * @param placements (itemId, rowIndex) 목록.
     * @return 신규 제출 반영 시 true, 이미 제출한 visitor면 false.
     */
    fun submit(sessionId: UUID, placements: List<Pair<String, Int>>, visitorKey: String): Boolean {
        val voters = StreamerValkeyKeys.tierSubmittedVoters(sessionId)
        val prefix = StreamerValkeyKeys.tierStatsPrefix(sessionId)
        val args = mutableListOf(visitorKey, SUBMIT_TTL_SECONDS.toString(), prefix, placements.size.toString())
        for ((itemId, rowIndex) in placements) {
            args += itemId
            args += rowIndex.toString()
        }
        val res = redisTemplate.execute(streamerTierSubmitScript, listOf(voters), *args.toTypedArray()) ?: 0L
        return res == 1L
    }

    fun totalSubmissions(sessionId: UUID): Long =
        redisTemplate.opsForSet().size(StreamerValkeyKeys.tierSubmittedVoters(sessionId)) ?: 0L

    fun loadStats(sessionId: UUID): TierStatsResponse {
        val prefix = StreamerValkeyKeys.tierStatsPrefix(sessionId)
        val opts = ScanOptions.scanOptions().match("$prefix*").count(200).build()
        val items = mutableListOf<TierItemStat>()
        redisTemplate.scan(opts).use { cursor ->
            while (cursor.hasNext()) {
                val key = cursor.next()
                val itemId = key.removePrefix(prefix)
                val entries = redisTemplate.opsForHash<String, String>().entries(key)
                items += buildItemStat(itemId, entries)
            }
        }
        items.sortBy { it.itemId }
        return TierStatsResponse(
            totalSubmissions = totalSubmissions(sessionId),
            items = items,
        )
    }

    private fun buildItemStat(itemId: String, entries: Map<String, String>): TierItemStat {
        val distribution = entries.mapValues { it.value.toLongOrNull() ?: 0L }
        val sampleCount = distribution.values.sum()
        return TierItemStat(itemId = itemId, distribution = distribution, sampleCount = sampleCount)
    }

    companion object {
        const val SUBMIT_TTL_SECONDS = 12L * 60 * 60
    }
}
