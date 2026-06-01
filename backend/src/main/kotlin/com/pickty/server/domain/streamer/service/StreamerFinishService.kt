package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.enums.StreamerFinishReason
import com.pickty.server.domain.streamer.valkey.StreamerSessionMeta
import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.ScanOptions
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * 세션 종료(방장 명시 / Sweeper 만료) 시 Valkey 집계를 PostgreSQL로 영속화한 뒤 Valkey 키를 정리.
 *
 * 트랜잭션은 [StreamerResultPersister]에 격리 — Valkey scan/del 같은 외부 I/O가 트랜잭션을 길게 잡지 않게 한다.
 */
@Service
class StreamerFinishService(
    private val sessionStateService: StreamerSessionStateService,
    private val redisTemplate: StringRedisTemplate,
    private val resultPersister: StreamerResultPersister,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun finishByHost(sessionId: UUID) {
        val meta = sessionStateService.getMeta(sessionId) ?: return
        sessionStateService.markFinished(sessionId)
        persistAndPurge(meta, StreamerFinishReason.HOST_FINISHED)
    }

    fun finishExpired(sessionId: UUID) {
        val meta = sessionStateService.getMeta(sessionId)
        if (meta == null) {
            sessionStateService.removeFromActive(sessionId)
            return
        }
        sessionStateService.markExpiredFinished(sessionId)
        persistAndPurge(meta, StreamerFinishReason.SWEEPER_EXPIRED)
    }

    private fun persistAndPurge(meta: StreamerSessionMeta, reason: StreamerFinishReason) {
        val dependentKeys = scanDependentKeys(meta.sessionId)
        val summary = buildSummary(meta.sessionId, dependentKeys)
        try {
            resultPersister.persistIfAbsent(
                meta = meta,
                reason = reason,
                summary = summary,
                startedAt = epochToLdt(meta.startedAt),
                finishedAt = LocalDateTime.now(),
            )
        } catch (ex: Exception) {
            log.error(
                "streamer session persist failed sessionId={} reason={}: {}",
                meta.sessionId, reason, ex.message, ex,
            )
            // 영속화 실패 시 Valkey 키는 유지(다음 Sweeper tick에서 재시도 가능).
            return
        }
        sessionStateService.purgeSessionKeys(meta.sessionId, dependentKeys)
    }

    private fun scanDependentKeys(sessionId: UUID): List<String> {
        val pattern = "streamer:session:$sessionId:*"
        val keys = mutableListOf<String>()
        val opts = ScanOptions.scanOptions().match(pattern).count(200).build()
        redisTemplate.scan(opts).use { cursor ->
            while (cursor.hasNext()) keys.add(cursor.next())
        }
        return keys
    }

    private fun buildSummary(sessionId: UUID, dependentKeys: List<String>): Map<String, Any?> {
        val matchPrefix = "streamer:session:$sessionId:match:"
        val matches = dependentKeys.filter { it.startsWith(matchPrefix) }
            .associate { fullKey ->
                val matchKey = fullKey.removePrefix(matchPrefix)
                val entries = redisTemplate.opsForHash<String, String>().entries(fullKey)
                matchKey to entries.mapValues { it.value.toLongOrNull() ?: 0L }
            }
        val quickVoteResults = redisTemplate.opsForHash<String, String>()
            .entries(StreamerValkeyKeys.quickVoteResults(sessionId))
            .mapValues { it.value.toLongOrNull() ?: 0L }

        val tierStatsPrefix = StreamerValkeyKeys.tierStatsPrefix(sessionId)
        val tierStats = dependentKeys.filter { it.startsWith(tierStatsPrefix) }
            .associate { fullKey ->
                val itemId = fullKey.removePrefix(tierStatsPrefix)
                val entries = redisTemplate.opsForHash<String, String>().entries(fullKey)
                itemId to entries.mapValues { it.value.toLongOrNull() ?: 0L }
            }
        val tierSubmissions = redisTemplate.opsForSet()
            .size(StreamerValkeyKeys.tierSubmittedVoters(sessionId)) ?: 0L

        return mapOf(
            "schemaVersion" to 1,
            "matches" to matches,
            "quickVoteResults" to quickVoteResults,
            "tierStats" to tierStats,
            "tierSubmissions" to tierSubmissions,
        )
    }

    private fun epochToLdt(epochSecond: Long): LocalDateTime =
        if (epochSecond <= 0L) LocalDateTime.now()
        else LocalDateTime.ofInstant(Instant.ofEpochSecond(epochSecond), ZoneOffset.UTC)
}
