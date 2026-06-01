package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.valkey.StreamerSessionMeta
import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 방장 SSE에 흘려보낼 페이로드 빌더.
 * - 현재 매치(left/right) 식별자는 메타 hash에 이미 분리 저장되어 있어 추가 파싱 없음
 * - 매치 득표 카운트 1회 HGETALL로 묶음
 */
@Service
class StreamerHostSsePayloadFactory(
    private val redisTemplate: StringRedisTemplate,
) {

    fun build(meta: StreamerSessionMeta): Map<String, Any?> {
        val matchPair = meta.currentMatchPair()
        val matchVotes = matchPair?.let { (l, r) -> loadMatchVotes(meta.sessionId, l, r) }
        val matchSection = matchPair?.let { (l, r) ->
            mapOf(
                "leftId" to l,
                "rightId" to r,
                "label" to meta.currentMatchLabel,
            )
        }
        return mapOf(
            "version" to meta.version,
            "status" to meta.status.name,
            "currentMatch" to matchSection,
            "matchVotes" to matchVotes,
            "quickVoteItemId" to meta.quickVoteItemId,
            "ts" to System.currentTimeMillis(),
        )
    }

    private fun loadMatchVotes(sessionId: UUID, leftId: String, rightId: String): Map<String, Long> {
        val (lo, hi) = if (leftId <= rightId) leftId to rightId else rightId to leftId
        val key = StreamerValkeyKeys.worldcupMatchVotes(sessionId, lo, hi)
        val entries = redisTemplate.opsForHash<String, String>().entries(key)
        if (entries.isEmpty()) return emptyMap()
        return entries.mapValues { it.value.toLongOrNull() ?: 0L }
    }
}
