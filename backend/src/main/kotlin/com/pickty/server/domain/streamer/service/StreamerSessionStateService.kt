package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.enums.StreamerSessionStatus
import com.pickty.server.domain.streamer.enums.StreamerTemplateType
import com.pickty.server.domain.streamer.valkey.StreamerSessionMeta
import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.data.redis.core.script.DefaultRedisScript
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.UUID

/**
 * 스트리머 세션 메타데이터(Valkey Hash) 전담 서비스.
 *
 * 모든 방장 액션은 [streamerSessionBumpScript]를 통해 1 RTT로 묶여
 * (필드 갱신 + version+1 + lastActiveTime + EXPIRE) 한 번에 처리된다.
 *
 * Lightsail 환경 부하 최소화를 위해 시청자 ETag 비교 경로에서는 [getVersion] 으로
 * 단일 HGET 만 사용한다.
 */
@Service
class StreamerSessionStateService(
    private val redisTemplate: StringRedisTemplate,
    private val streamerSessionBumpScript: DefaultRedisScript<Long>,
) {

    /**
     * @return 발급된 세션 ID + hostToken.
     */
    fun createSession(
        templateType: StreamerTemplateType,
        templateId: UUID,
        hostUserId: Long,
        boardConfigJson: String? = null,
    ): CreatedSession {
        val sessionId = UUID.randomUUID()
        val hostToken = "h-" + UUID.randomUUID()
        val now = Instant.now().epochSecond
        val key = StreamerValkeyKeys.sessionMeta(sessionId)

        val hash = linkedMapOf(
            StreamerSessionMeta.F_SESSION_ID to sessionId.toString(),
            StreamerSessionMeta.F_HOST_TOKEN to hostToken,
            StreamerSessionMeta.F_HOST_USER_ID to hostUserId.toString(),
            StreamerSessionMeta.F_TEMPLATE_TYPE to templateType.name,
            StreamerSessionMeta.F_TEMPLATE_ID to templateId.toString(),
            StreamerSessionMeta.F_STATUS to StreamerSessionStatus.READY.name,
            StreamerSessionMeta.F_VERSION to "1",
            StreamerSessionMeta.F_LAST_ACTIVE_TIME to now.toString(),
            StreamerSessionMeta.F_STARTED_AT to now.toString(),
        )
        if (!boardConfigJson.isNullOrBlank()) {
            hash[StreamerSessionMeta.F_BOARD_CONFIG] = boardConfigJson
        }

        redisTemplate.executePipelined { conn ->
            val ser = redisTemplate.stringSerializer
            conn.hashCommands().hMSet(
                ser.serialize(key)!!,
                hash.mapKeys { ser.serialize(it.key)!! }.mapValues { ser.serialize(it.value)!! },
            )
            conn.keyCommands().expire(ser.serialize(key)!!, SESSION_TTL_SECONDS)
            conn.setCommands().sAdd(ser.serialize(StreamerValkeyKeys.ACTIVE_SESSIONS_SET)!!, ser.serialize(sessionId.toString())!!)
            null
        }

        return CreatedSession(sessionId = sessionId, hostToken = hostToken, startedAt = now)
    }

    fun getMeta(sessionId: UUID): StreamerSessionMeta? {
        val key = StreamerValkeyKeys.sessionMeta(sessionId)
        val entries = redisTemplate.opsForHash<String, String>().entries(key)
        if (entries.isEmpty()) return null
        return StreamerSessionMeta.fromHash(sessionId, entries)
    }

    /**
     * ETag 비교용 — 메타 전체를 끌어오지 않고 version 필드만 가져온다.
     * 키가 없거나 필드가 없으면 null.
     */
    fun getVersion(sessionId: UUID): Long? {
        val key = StreamerValkeyKeys.sessionMeta(sessionId)
        val raw = redisTemplate.opsForHash<String, String>().get(key, StreamerSessionMeta.F_VERSION)
        return raw?.toLongOrNull()
    }

    fun verifyHostToken(sessionId: UUID, token: String): Boolean {
        if (token.isBlank()) return false
        val key = StreamerValkeyKeys.sessionMeta(sessionId)
        val stored = redisTemplate.opsForHash<String, String>().get(key, StreamerSessionMeta.F_HOST_TOKEN)
        return stored != null && constantTimeEquals(stored, token)
    }

    fun setCurrentMatch(sessionId: UUID, leftId: String, rightId: String, label: String?): Long {
        val fields = linkedMapOf(
            StreamerSessionMeta.F_MATCH_LEFT_ID to leftId,
            StreamerSessionMeta.F_MATCH_RIGHT_ID to rightId,
            StreamerSessionMeta.F_MATCH_LABEL to (label?.takeIf { it.isNotBlank() } ?: DELETE_MARKER),
            StreamerSessionMeta.F_STATUS to StreamerSessionStatus.PLAYING.name,
        )
        return bump(sessionId, fields)
    }

    fun startQuickVote(sessionId: UUID, itemId: String): Long =
        bump(sessionId, mapOf(StreamerSessionMeta.F_QUICK_VOTE_ITEM_ID to itemId, StreamerSessionMeta.F_STATUS to StreamerSessionStatus.PLAYING.name))

    fun stopQuickVote(sessionId: UUID): Long =
        bump(sessionId, mapOf(StreamerSessionMeta.F_QUICK_VOTE_ITEM_ID to DELETE_MARKER))

    fun markFinished(sessionId: UUID): Long {
        val v = bump(sessionId, mapOf(StreamerSessionMeta.F_STATUS to StreamerSessionStatus.FINISHED.name))
        redisTemplate.opsForSet().remove(StreamerValkeyKeys.ACTIVE_SESSIONS_SET, sessionId.toString())
        return v
    }

    fun markExpiredFinished(sessionId: UUID): Long {
        val v = bump(sessionId, mapOf(StreamerSessionMeta.F_STATUS to StreamerSessionStatus.EXPIRED_FINISHED.name))
        redisTemplate.opsForSet().remove(StreamerValkeyKeys.ACTIVE_SESSIONS_SET, sessionId.toString())
        return v
    }

    fun loadActiveSessionIds(): Set<UUID> {
        val raw = redisTemplate.opsForSet().members(StreamerValkeyKeys.ACTIVE_SESSIONS_SET) ?: return emptySet()
        return raw.mapNotNull { runCatching { UUID.fromString(it) }.getOrNull() }.toSet()
    }

    fun removeFromActive(sessionId: UUID) {
        redisTemplate.opsForSet().remove(StreamerValkeyKeys.ACTIVE_SESSIONS_SET, sessionId.toString())
    }

    /**
     * 세션 종료 후 부속 키들을 일괄 삭제. matchKeys는 호출 측에서 SCAN 또는 사전 보관해 전달.
     */
    fun purgeSessionKeys(sessionId: UUID, dependentKeys: Collection<String>) {
        val keys = buildList {
            add(StreamerValkeyKeys.sessionMeta(sessionId))
            add(StreamerValkeyKeys.quickVoteResults(sessionId))
            add(StreamerValkeyKeys.tierSubmittedVoters(sessionId))
            addAll(dependentKeys)
        }
        redisTemplate.delete(keys)
        removeFromActive(sessionId)
    }

    private fun bump(sessionId: UUID, fields: Map<String, String>): Long {
        val key = StreamerValkeyKeys.sessionMeta(sessionId)
        val now = Instant.now().epochSecond
        val args = mutableListOf<String>()
        args += SESSION_TTL_SECONDS.toString()
        args += now.toString()
        args += fields.size.toString()
        for ((f, v) in fields) {
            args += f
            args += v
        }
        val newVersion = redisTemplate.execute(streamerSessionBumpScript, listOf(key), *args.toTypedArray()) ?: -1L
        if (newVersion < 0) {
            throw StreamerSessionNotFoundException(sessionId)
        }
        return newVersion
    }

    private fun constantTimeEquals(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var diff = 0
        for (i in a.indices) {
            diff = diff or (a[i].code xor b[i].code)
        }
        return diff == 0
    }

    data class CreatedSession(
        val sessionId: UUID,
        val hostToken: String,
        val startedAt: Long,
    )

    companion object {
        const val SESSION_TTL_SECONDS = 12L * 60 * 60
        const val DELETE_MARKER = "__DEL__"
    }
}

class StreamerSessionNotFoundException(val sessionId: UUID) : RuntimeException("streamer session not found: $sessionId")
