package com.pickty.server.domain.streamer.scheduler

import com.pickty.server.domain.streamer.service.StreamerFinishService
import com.pickty.server.domain.streamer.service.StreamerSessionStateService
import com.pickty.server.domain.streamer.valkey.StreamerSessionMeta
import com.pickty.server.domain.streamer.valkey.StreamerValkeyKeys
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.time.Instant
import java.util.UUID

/**
 * 방장이 명시적으로 종료하지 않은 방치 세션을 주기적으로 감지하여 강제 종료한다.
 *
 * - 30분 간격으로 active 세션 ID Set을 순회
 * - `lastActiveTime` 이 [idleThresholdSeconds] (기본 7200=2h)를 초과한 세션을 `EXPIRED_FINISHED` 로 처리
 * - 메타 hash가 이미 자연 TTL로 사라진 세션은 active Set에서만 정리
 * - 한 tick 처리량 상한을 두어 과도한 부하 방지
 */
@Component
class StreamerIdleSessionSweeper(
    private val redisTemplate: StringRedisTemplate,
    private val sessionStateService: StreamerSessionStateService,
    private val finishService: StreamerFinishService,
    @Value("\${pickty.streamer.idle-threshold-seconds:7200}")
    private val idleThresholdSeconds: Long,
    @Value("\${pickty.streamer.sweeper-batch-limit:200}")
    private val sweeperBatchLimit: Int,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "0 0/30 * * * *")
    fun sweep() {
        val activeIds = sessionStateService.loadActiveSessionIds()
        if (activeIds.isEmpty()) return

        val now = Instant.now().epochSecond
        var processed = 0
        var expired = 0
        var orphans = 0

        for (sessionId in activeIds) {
            if (processed >= sweeperBatchLimit) break
            processed++
            try {
                val lastActive = readLastActiveTime(sessionId)
                if (lastActive == null) {
                    sessionStateService.removeFromActive(sessionId)
                    orphans++
                    continue
                }
                val idleFor = now - lastActive
                if (idleFor >= idleThresholdSeconds) {
                    finishService.finishExpired(sessionId)
                    expired++
                }
            } catch (ex: Exception) {
                log.warn("idle sweeper iteration failed sessionId={}: {}", sessionId, ex.message)
            }
        }
        if (expired > 0 || orphans > 0) {
            log.info(
                "streamer idle sweep: processed={} expired={} orphans={} (limit={})",
                processed, expired, orphans, sweeperBatchLimit,
            )
        }
    }

    private fun readLastActiveTime(sessionId: UUID): Long? {
        val key = StreamerValkeyKeys.sessionMeta(sessionId)
        val raw = redisTemplate.opsForHash<String, String>().get(key, StreamerSessionMeta.F_LAST_ACTIVE_TIME)
        return raw?.toLongOrNull()
    }
}
