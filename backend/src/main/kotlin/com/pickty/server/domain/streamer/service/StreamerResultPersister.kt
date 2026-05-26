package com.pickty.server.domain.streamer.service

import com.pickty.server.domain.streamer.entity.StreamerSessionResult
import com.pickty.server.domain.streamer.enums.StreamerFinishReason
import com.pickty.server.domain.streamer.repository.StreamerSessionResultRepository
import com.pickty.server.domain.streamer.valkey.StreamerSessionMeta
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

/**
 * 같은 클래스 self-invocation 시 `@Transactional` 미적용 문제를 피하기 위해 영속화 책임을 분리한다.
 */
@Service
class StreamerResultPersister(
    private val resultRepository: StreamerSessionResultRepository,
) {
    @Transactional
    fun persistIfAbsent(
        meta: StreamerSessionMeta,
        reason: StreamerFinishReason,
        summary: Map<String, Any?>,
        startedAt: LocalDateTime,
        finishedAt: LocalDateTime,
    ) {
        if (resultRepository.existsBySessionId(meta.sessionId)) return
        resultRepository.save(
            StreamerSessionResult(
                sessionId = meta.sessionId,
                templateType = meta.templateType,
                templateId = meta.templateId,
                hostUserId = meta.hostUserId,
                finishReason = reason,
                summary = summary,
                startedAt = startedAt,
                finishedAt = finishedAt,
            ),
        )
    }
}
