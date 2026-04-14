package com.pickty.server.domain.view.service

import org.slf4j.LoggerFactory
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.util.UUID
import kotlin.collections.iterator

/**
 * Valkey(Hash)에 쌓는 미반영 조회수 + 배치용 원자 drain.
 * 상세 GET 응답과 합산을 맞추기 위해 [bumpTemplatePending]/[bumpResultPending]은 동기 HINCRBY 1회로 처리한다.
 * (비동기만 쓰면 같은 요청에서 Redis 증가 전에 읽어 1회분이 빠질 수 있음.)
 */
@Service
class ViewCountService(
    private val redisTemplate: StringRedisTemplate,
    private val viewCountHashDrainScript: DefaultRedisScript<List<*>>,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    /** @return 증가 후 해당 id의 Valkey 미반영 누적치 (Valkey 실패 시 0) */
    fun bumpTemplatePending(id: UUID): Long =
        runCatching {
            redisTemplate.opsForHash<String, String>().increment(HASH_TEMPLATES, id.toString(), 1L) ?: 1L
        }.getOrElse { e ->
            log.warn("template view bump failed id={}: {}", id, e.message)
            0L
        }

    /** @return 증가 후 해당 id의 Valkey 미반영 누적치 (Valkey 실패 시 0) */
    fun bumpResultPending(id: UUID): Long =
        runCatching {
            redisTemplate.opsForHash<String, String>().increment(HASH_RESULTS, id.toString(), 1L) ?: 1L
        }.getOrElse { e ->
            log.warn("tier result view bump failed id={}: {}", id, e.message)
            0L
        }

    fun templatePendingMulti(ids: List<UUID>): Map<UUID, Long> = pendingMulti(HASH_TEMPLATES, ids)

    fun resultPendingMulti(ids: List<UUID>): Map<UUID, Long> = pendingMulti(HASH_RESULTS, ids)

    private fun pendingMulti(key: String, ids: List<UUID>): Map<UUID, Long> {
        if (ids.isEmpty()) return emptyMap()
        return runCatching {
            val strIds = ids.map { it.toString() }
            val vals = redisTemplate.opsForHash<String, String>().multiGet(key, strIds) ?: emptyList()
            ids.mapIndexed { i, id ->
                val v = vals.getOrNull(i)?.toLongOrNull() ?: 0L
                id to v
            }.toMap()
        }.getOrElse { e ->
            log.warn("view pending HMGET failed key={}: {}", key, e.message)
            ids.associateWith { 0L }
        }
    }

    /**
     * Lua로 HGETALL + 양수 필드 HDEL을 한 번에 수행. 배치가 DB 반영에 실패하면 호출 측에서 복구해야 한다.
     */
    fun atomicDrain(key: String): Map<UUID, Long> =
        runCatching { atomicDrainOrThrow(key) }.getOrElse { e ->
            log.warn("view count atomic drain failed key={}: {}", key, e.message)
            emptyMap()
        }

    private fun atomicDrainOrThrow(key: String): Map<UUID, Long> {
        @Suppress("UNCHECKED_CAST")
        val raw = redisTemplate.execute(viewCountHashDrainScript, listOf(key)) as? List<*> ?: emptyList<Any>()
        if (raw.isEmpty()) return emptyMap()
        val out = LinkedHashMap<UUID, Long>()
        var i = 0
        while (i + 1 < raw.size) {
            val idStr = raw[i]?.toString() ?: break
            val numStr = raw[i + 1]?.toString() ?: break
            i += 2
            runCatching {
                val id = UUID.fromString(idStr)
                val n = numStr.toLong()
                if (n > 0) out[id] = n
            }.onFailure { e -> log.warn("skip drain entry id={} v={}: {}", idStr, numStr, e.message) }
        }
        return out
    }

    fun restoreTemplateDeltas(deltas: Map<UUID, Long>) = restore(HASH_TEMPLATES, deltas)

    fun restoreResultDeltas(deltas: Map<UUID, Long>) = restore(HASH_RESULTS, deltas)

    private fun restore(key: String, deltas: Map<UUID, Long>) {
        if (deltas.isEmpty()) return
        for ((id, v) in deltas) {
            if (v <= 0L) continue
            runCatching {
                redisTemplate.opsForHash<String, String>().increment(key, id.toString(), v)
            }.onFailure { e -> log.warn("view count restore failed key={} id={}: {}", key, id, e.message) }
        }
    }

    companion object {
        const val HASH_TEMPLATES = "pickty:views:templates"
        const val HASH_RESULTS = "pickty:views:results"
    }
}