package com.pickty.server.domain.streamer.controller

import com.pickty.server.domain.streamer.dto.CreateStreamerSessionRequest
import com.pickty.server.domain.streamer.dto.CreatedStreamerSessionResponse
import com.pickty.server.domain.streamer.dto.FallbackHostTokenResponse
import com.pickty.server.domain.streamer.dto.IssueSseTicketResponse
import com.pickty.server.domain.streamer.dto.StartQuickVoteRequest
import com.pickty.server.domain.streamer.dto.UpdateCurrentMatchRequest
import com.pickty.server.domain.streamer.enums.StreamerSessionStatus
import com.pickty.server.domain.streamer.service.StreamerFinishService
import com.pickty.server.domain.streamer.service.StreamerSessionStateService
import com.pickty.server.domain.streamer.service.StreamerSseManager
import com.pickty.server.domain.streamer.service.StreamerSseTicketService
import com.pickty.server.domain.streamer.web.StreamerHttpSupport
import com.pickty.server.global.security.resolveUserIdOrThrow
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter
import java.util.UUID

/**
 * 방장(스트리머) 전용 제어 + SSE 구독.
 *
 * - 세션 생성/Fallback 토큰 재발급: 로그인 필요
 * - 매치/퀵투표/finish/티켓 발급: `X-Host-Token` 헤더 필요
 * - SSE 구독: 단기 ticket 쿼리 파라미터로 인증
 */
@RestController
@RequestMapping("/api/v1/streamer/sessions")
class StreamerHostController(
    private val sessionStateService: StreamerSessionStateService,
    private val sseManager: StreamerSseManager,
    private val sseTicketService: StreamerSseTicketService,
    private val finishService: StreamerFinishService,
) {

    @PostMapping
    fun createSession(
        @Valid @RequestBody body: CreateStreamerSessionRequest,
        authentication: Authentication?,
    ): ResponseEntity<CreatedStreamerSessionResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val created = sessionStateService.createSession(body.templateType, body.templateId, userId)
        return ResponseEntity.status(HttpStatus.CREATED).body(
            CreatedStreamerSessionResponse(
                sessionId = created.sessionId,
                hostToken = created.hostToken,
                templateType = body.templateType,
                templateId = body.templateId,
                startedAt = created.startedAt,
            ),
        )
    }

    @GetMapping("/{sessionId}/fallback-token")
    fun fallbackHostToken(
        @PathVariable sessionId: UUID,
        authentication: Authentication?,
    ): ResponseEntity<FallbackHostTokenResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val meta = sessionStateService.getMeta(sessionId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "session not found")
        if (meta.hostUserId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not session host")
        }
        return ResponseEntity.ok(FallbackHostTokenResponse(sessionId = sessionId, hostToken = meta.hostToken))
    }

    @PutMapping("/{sessionId}/match")
    fun updateMatch(
        @PathVariable sessionId: UUID,
        @Valid @RequestBody body: UpdateCurrentMatchRequest,
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        StreamerHttpSupport.requireHostToken(sessionStateService, sessionId, request)
        val version = sessionStateService.setCurrentMatch(sessionId, body.leftId, body.rightId, body.label)
        sseManager.markDirty(sessionId)
        return ResponseEntity.ok(mapOf("version" to version))
    }

    @PostMapping("/{sessionId}/quick-vote/start")
    fun startQuickVote(
        @PathVariable sessionId: UUID,
        @Valid @RequestBody body: StartQuickVoteRequest,
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        StreamerHttpSupport.requireHostToken(sessionStateService, sessionId, request)
        val version = sessionStateService.startQuickVote(sessionId, body.itemId)
        sseManager.markDirty(sessionId)
        return ResponseEntity.ok(mapOf("version" to version, "quickVoteItemId" to body.itemId))
    }

    @PostMapping("/{sessionId}/quick-vote/stop")
    fun stopQuickVote(
        @PathVariable sessionId: UUID,
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        StreamerHttpSupport.requireHostToken(sessionStateService, sessionId, request)
        val version = sessionStateService.stopQuickVote(sessionId)
        sseManager.markDirty(sessionId)
        return ResponseEntity.ok(mapOf("version" to version))
    }

    @PostMapping("/{sessionId}/finish")
    fun finishSession(
        @PathVariable sessionId: UUID,
        request: HttpServletRequest,
    ): ResponseEntity<Map<String, Any?>> {
        StreamerHttpSupport.requireHostToken(sessionStateService, sessionId, request)
        finishService.finishByHost(sessionId)
        sseManager.markDirty(sessionId)
        sseManager.close(sessionId)
        return ResponseEntity.ok(mapOf("status" to StreamerSessionStatus.FINISHED.name))
    }

    @PostMapping("/{sessionId}/ticket")
    fun issueSseTicket(
        @PathVariable sessionId: UUID,
        request: HttpServletRequest,
    ): ResponseEntity<IssueSseTicketResponse> {
        val hostToken = StreamerHttpSupport.requireHostToken(sessionStateService, sessionId, request)
        val ticketId = sseTicketService.issue(sessionId, hostToken)
        return ResponseEntity.ok(IssueSseTicketResponse(ticketId, StreamerSseTicketService.TTL_SECONDS))
    }

    @GetMapping("/{sessionId}/sse", produces = [MediaType.TEXT_EVENT_STREAM_VALUE])
    fun subscribeSse(
        @PathVariable sessionId: UUID,
        @RequestParam("ticket") ticket: UUID,
    ): SseEmitter {
        val consumed = sseTicketService.consume(ticket)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid ticket")
        val (issuedSessionId, hostToken) = consumed
        if (issuedSessionId != sessionId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "ticket session mismatch")
        }
        if (!sessionStateService.verifyHostToken(sessionId, hostToken)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "host token revoked")
        }
        return sseManager.register(sessionId)
    }
}
