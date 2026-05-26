package com.pickty.server.domain.streamer.entity

import com.pickty.server.domain.streamer.enums.StreamerFinishReason
import com.pickty.server.domain.streamer.enums.StreamerTemplateType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.LocalDateTime
import java.util.UUID

@Entity
@Table(name = "streamer_session_results")
class StreamerSessionResult(
    sessionId: UUID,
    templateType: StreamerTemplateType,
    templateId: UUID,
    hostUserId: Long?,
    finishReason: StreamerFinishReason,
    summary: Map<String, Any?>,
    startedAt: LocalDateTime,
    finishedAt: LocalDateTime,
) {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    @Column(name = "session_id", columnDefinition = "uuid", nullable = false, unique = true, updatable = false)
    var sessionId: UUID = sessionId
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "template_type", nullable = false, length = 16, updatable = false)
    var templateType: StreamerTemplateType = templateType
        protected set

    @Column(name = "template_id", columnDefinition = "uuid", nullable = false, updatable = false)
    var templateId: UUID = templateId
        protected set

    @Column(name = "host_user_id")
    var hostUserId: Long? = hostUserId
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "finish_reason", nullable = false, length = 24, updatable = false)
    var finishReason: StreamerFinishReason = finishReason
        protected set

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "summary", columnDefinition = "jsonb", nullable = false)
    var summary: Map<String, Any?> = summary
        protected set

    @Column(name = "started_at", nullable = false, updatable = false)
    var startedAt: LocalDateTime = startedAt
        protected set

    @Column(name = "finished_at", nullable = false, updatable = false)
    var finishedAt: LocalDateTime = finishedAt
        protected set

    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: LocalDateTime = LocalDateTime.now()
        protected set
}
