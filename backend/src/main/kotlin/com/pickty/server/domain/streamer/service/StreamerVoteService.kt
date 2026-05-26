package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import com.pickty.server.global.util.Sha256Hex
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.util.UUID

/**
 * 월드컵 매치별 실시간 투표 카운터 + 중복 차단.
 *
 * 차단 키 스코프 = 매치 단위(`{leftId}_{rightId}`). 다음 매치로 넘어가면 시청자가 재차 투표 가능.
 * 식별자 = `SHA256(clientIp + ":" + visitorId)` — NAT 환경(카페·기숙사) 공인 IP 다인 투표를 허용한다.
 */
@Service
class StreamerVoteService(
    private val redisTemplate: StringRedisTemplate,
    private val streamerVoteOnceScript: DefaultRedisScript<Long>,
) {

    fun visitorKey(clientIp: String, visitorId: String): String =
        Sha256Hex.hash("$clientIp:$visitorId")

    /**
     * @return 신규 1표 반영 시 true, 중복 투표면 false.
     */
    fun castWorldcupVote(
        sessionId: UUID,
        leftId: String,
        rightId: String,
        selectedId: String,
        visitorKey: String,
    ): Boolean {
        val (canonicalLeft, canonicalRight) = canonicalizeMatch(leftId, rightId)
        val votersKey = StreamerValkeyKeys.worldcupMatchVoters(sessionId, canonicalLeft, canonicalRight)
        val votesKey = StreamerValkeyKeys.worldcupMatchVotes(sessionId, canonicalLeft, canonicalRight)
        val res = redisTemplate.execute(
            streamerVoteOnceScript,
            listOf(votersKey, votesKey),
            visitorKey,
            selectedId,
            SCOPED_TTL_SECONDS.toString(),
        ) ?: 0L
        return res == 1L
    }

    fun loadWorldcupVotes(sessionId: UUID, leftId: String, rightId: String): Map<String, Long> {
        val (canonicalLeft, canonicalRight) = canonicalizeMatch(leftId, rightId)
        val votesKey = StreamerValkeyKeys.worldcupMatchVotes(sessionId, canonicalLeft, canonicalRight)
        val entries = redisTemplate.opsForHash<String, String>().entries(votesKey)
        if (entries.isEmpty()) return emptyMap()
        return entries.mapValues { it.value.toLongOrNull() ?: 0L }
    }

    /**
     * 매치 키 정규화 — 클라이언트가 매치를 표현하는 순서가 좌우 바뀌어도 같은 키로 매핑되게 한다.
     */
    private fun canonicalizeMatch(a: String, b: String): Pair<String, String> =
        if (a <= b) a to b else b to a

    companion object {
        const val SCOPED_TTL_SECONDS = 12L * 60 * 60
    }
}
