package com.pickty.server.domain.streamer.repository

import com.pickty.server.domain.streamer.entity.StreamerSessionResult
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface StreamerSessionResultRepository : JpaRepository<StreamerSessionResult, Long> {
    fun existsBySessionId(sessionId: UUID): Boolean
    fun findByHostUserIdOrderByFinishedAtDesc(hostUserId: Long): List<StreamerSessionResult>
    fun findByIdAndHostUserId(id: Long, hostUserId: Long): StreamerSessionResult?
}
