package com.pickty.server.domain.streamer.valkey

import com.pickty.server.domain.streamer.enums.StreamerSessionStatus
import com.pickty.server.domain.streamer.enums.StreamerTemplateType
import java.util.UUID

/**
 * Valkey Hash 형태로 보관되는 스트리머 세션 메타데이터.
 * 모든 필드는 String으로 저장되며 본 객체에서 타입을 복원한다.
 */
data class StreamerSessionMeta(
    val sessionId: UUID,
    val hostToken: String,
    val hostUserId: Long?,
    val templateType: StreamerTemplateType,
    val templateId: UUID,
    val status: StreamerSessionStatus,
    val version: Long,
    val currentMatchLeftId: String?,
    val currentMatchRightId: String?,
    val currentMatchLabel: String?,
    val quickVoteItemId: String?,
    val lastActiveTime: Long,
    val startedAt: Long,
) {
    fun currentMatchPair(): Pair<String, String>? {
        val l = currentMatchLeftId
        val r = currentMatchRightId
        return if (l.isNullOrBlank() || r.isNullOrBlank()) null else l to r
    }

    companion object {
        const val F_SESSION_ID = "sessionId"
        const val F_HOST_TOKEN = "hostToken"
        const val F_HOST_USER_ID = "hostUserId"
        const val F_TEMPLATE_TYPE = "templateType"
        const val F_TEMPLATE_ID = "templateId"
        const val F_STATUS = "status"
        const val F_VERSION = "version"
        const val F_MATCH_LEFT_ID = "matchLeftId"
        const val F_MATCH_RIGHT_ID = "matchRightId"
        const val F_MATCH_LABEL = "matchLabel"
        const val F_QUICK_VOTE_ITEM_ID = "quickVoteItemId"
        const val F_LAST_ACTIVE_TIME = "lastActiveTime"
        const val F_STARTED_AT = "startedAt"

        fun fromHash(sessionId: UUID, hash: Map<String, String>): StreamerSessionMeta? {
            if (hash.isEmpty()) return null
            val hostToken = hash[F_HOST_TOKEN] ?: return null
            val templateType = hash[F_TEMPLATE_TYPE]?.let { runCatching { StreamerTemplateType.valueOf(it) }.getOrNull() }
                ?: return null
            val templateId = hash[F_TEMPLATE_ID]?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                ?: return null
            val status = hash[F_STATUS]?.let { runCatching { StreamerSessionStatus.valueOf(it) }.getOrNull() }
                ?: StreamerSessionStatus.READY
            return StreamerSessionMeta(
                sessionId = sessionId,
                hostToken = hostToken,
                hostUserId = hash[F_HOST_USER_ID]?.toLongOrNull(),
                templateType = templateType,
                templateId = templateId,
                status = status,
                version = hash[F_VERSION]?.toLongOrNull() ?: 0L,
                currentMatchLeftId = hash[F_MATCH_LEFT_ID]?.takeIf { it.isNotEmpty() },
                currentMatchRightId = hash[F_MATCH_RIGHT_ID]?.takeIf { it.isNotEmpty() },
                currentMatchLabel = hash[F_MATCH_LABEL]?.takeIf { it.isNotEmpty() },
                quickVoteItemId = hash[F_QUICK_VOTE_ITEM_ID]?.takeIf { it.isNotEmpty() },
                lastActiveTime = hash[F_LAST_ACTIVE_TIME]?.toLongOrNull() ?: 0L,
                startedAt = hash[F_STARTED_AT]?.toLongOrNull() ?: 0L,
            )
        }
    }
}
