package com.pickty.server.domain.streamer.service

import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.io.IOException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * 방장 SSE Emitter 보관 + 1초 스로틀 푸시.
 *
 * - 1세션 1 Emitter (재연결 시 기존 emitter close 후 교체)
 * - host action(매치 갱신/퀵투표 등)이 일어나면 [markDirty]로 표시
 * - 전역 1초 tick 에서 dirty 표시된 세션만 모아 한 번에 push
 * - 매 투표마다 push 하지 않으므로 Lightsail 1GB JVM에서 CPU·메모리 안정성 확보
 */
@Component
class StreamerSseManager(
    private val sessionStateService: StreamerSessionStateService,
    private val payloadFactory: StreamerHostSsePayloadFactory,
) {

    private val log = LoggerFactory.getLogger(javaClass)
    private val emitters: MutableMap<UUID, SseEmitter> = ConcurrentHashMap()
    private val dirty: MutableSet<UUID> = ConcurrentHashMap.newKeySet()

    fun register(sessionId: UUID): SseEmitter {
        val emitter = SseEmitter(EMITTER_TIMEOUT_MS)
        emitter.onCompletion { detach(sessionId, emitter) }
        emitter.onTimeout { detach(sessionId, emitter) }
        emitter.onError { detach(sessionId, emitter) }

        val previous = emitters.put(sessionId, emitter)
        previous?.let { runCatching { it.complete() } }

        runCatching { pushOnce(sessionId, emitter) }.onFailure {
            log.warn("initial SSE push failed sessionId={} err={}", sessionId, it.message)
        }
        return emitter
    }

    fun close(sessionId: UUID) {
        val e = emitters.remove(sessionId) ?: return
        runCatching { e.complete() }
        dirty.remove(sessionId)
    }

    fun markDirty(sessionId: UUID) {
        if (emitters.containsKey(sessionId)) {
            dirty.add(sessionId)
        }
    }

    @Scheduled(fixedRate = 1000L)
    fun flushDirty() {
        if (dirty.isEmpty()) return
        val snapshot = HashSet(dirty)
        dirty.removeAll(snapshot)
        for (sessionId in snapshot) {
            val emitter = emitters[sessionId] ?: continue
            try {
                pushOnce(sessionId, emitter)
            } catch (ex: IOException) {
                log.info("SSE peer closed sessionId={}", sessionId)
                detach(sessionId, emitter)
            } catch (ex: Exception) {
                log.warn("SSE push failed sessionId={}: {}", sessionId, ex.message)
                detach(sessionId, emitter)
            }
        }
    }

    private fun pushOnce(sessionId: UUID, emitter: SseEmitter) {
        val meta = sessionStateService.getMeta(sessionId) ?: return
        val payload = payloadFactory.build(meta)
        emitter.send(SseEmitter.event().name("hostUpdate").data(payload))
    }

    private fun detach(sessionId: UUID, emitter: SseEmitter) {
        emitters.remove(sessionId, emitter)
        dirty.remove(sessionId)
    }

    companion object {
        const val EMITTER_TIMEOUT_MS = 30L * 60 * 1000
    }
}
