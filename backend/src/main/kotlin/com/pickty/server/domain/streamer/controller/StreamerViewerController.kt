package com.pickty.server.domain.streamer.controller

import com.pickty.server.domain.streamer.dto.CurrentMatchPayload
import com.pickty.server.domain.streamer.dto.StreamerSessionStatusResponse
import com.pickty.server.domain.streamer.dto.WorldcupVoteRequest
import com.pickty.server.domain.streamer.dto.WorldcupVoteResponse
import com.pickty.server.domain.streamer.service.StreamerActiveUserCounter
import com.pickty.server.domain.streamer.service.StreamerPollBackoff
import com.pickty.server.domain.streamer.service.StreamerSessionStateService
import com.pickty.server.domain.streamer.service.StreamerSseManager
import com.pickty.server.domain.streamer.service.StreamerVoteService
import com.pickty.server.domain.streamer.web.StreamerHttpSupport
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

/**
 * 시청자(viewer) 전용 — ETag 기반 status 폴링 + 실시간 매치 투표.
 *
 * Lightsail 1GB JVM 보호를 위한 핵심:
 * - status 304 hit 시 JSON 직렬화 0 + 본문 0 byte 응답
 * - 헤더 `X-Next-Poll-Interval`은 304/200 모두에 동봉 → 클라이언트 즉시 백오프 반영
 * - 매 폴링 1 Lua RTT(HLL PFADD + PFCOUNT) 만 추가 사용
 */
@RestController
@RequestMapping("/api/v1/streamer/sessions")
class StreamerViewerController(
    private val sessionStateService: StreamerSessionStateService,
    private val activeUserCounter: StreamerActiveUserCounter,
    private val voteService: StreamerVoteService,
    private val sseManager: StreamerSseManager,
) {

    @GetMapping("/{sessionId}/status")
    fun status(
        @PathVariable sessionId: UUID,
        @RequestParam(value = "visitorId", required = false) visitorIdParam: String?,
        request: HttpServletRequest,
    ): ResponseEntity<StreamerSessionStatusResponse> {
        val version = sessionStateService.getVersion(sessionId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "session not found")

        val visitorKey = buildVisitorKey(request, visitorIdParam)
        val activeCount = activeUserCounter.touchAndCount(sessionId, visitorKey)
        val currentInterval = StreamerHttpSupport.extractClientPollInterval(request)
        val nextInterval = StreamerPollBackoff.nextInterval(currentInterval, activeCount)
        val etag = StreamerHttpSupport.makeEtagHeader(version)

        val ifNoneMatchVersion = StreamerHttpSupport.parseIfNoneMatchVersion(request)
        if (ifNoneMatchVersion != null && ifNoneMatchVersion == version) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED)
                .eTag(etag)
                .header(StreamerHttpSupport.HEADER_NEXT_POLL_INTERVAL, nextInterval.toString())
                .build()
        }

        val meta = sessionStateService.getMeta(sessionId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "session not found")

        val body = StreamerSessionStatusResponse(
            sessionId = meta.sessionId,
            status = meta.status,
            templateType = meta.templateType,
            templateId = meta.templateId,
            version = meta.version,
            currentMatch = meta.currentMatchPair()?.let { (l, r) ->
                CurrentMatchPayload(leftId = l, rightId = r, label = meta.currentMatchLabel)
            },
            quickVoteItemId = meta.quickVoteItemId,
            nextPollIntervalSeconds = nextInterval,
            activeUserCount = activeCount,
        )

        return ResponseEntity.ok()
            .eTag(StreamerHttpSupport.makeEtagHeader(meta.version))
            .header(StreamerHttpSupport.HEADER_NEXT_POLL_INTERVAL, nextInterval.toString())
            .body(body)
    }

    @PostMapping("/{sessionId}/vote")
    fun castWorldcupVote(
        @PathVariable sessionId: UUID,
        @Valid @RequestBody body: WorldcupVoteRequest,
        request: HttpServletRequest,
    ): ResponseEntity<WorldcupVoteResponse> {
        if (body.selectedId != body.leftId && body.selectedId != body.rightId) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "selectedId must be one of leftId/rightId")
        }
        if (sessionStateService.getVersion(sessionId) == null) {
            throw ResponseStatusException(HttpStatus.NOT_FOUND, "session not found")
        }

        val visitorKey = voteService.visitorKey(ClientIpResolver.resolve(request), body.visitorId)
        val accepted = voteService.castWorldcupVote(
            sessionId = sessionId,
            leftId = body.leftId,
            rightId = body.rightId,
            selectedId = body.selectedId,
            visitorKey = visitorKey,
        )
        if (accepted) {
            sseManager.markDirty(sessionId)
        }
        val votes = voteService.loadWorldcupVotes(sessionId, body.leftId, body.rightId)
        return ResponseEntity.ok(
            WorldcupVoteResponse(
                accepted = accepted,
                duplicate = !accepted,
                votes = votes,
            ),
        )
    }

    private fun buildVisitorKey(request: HttpServletRequest, visitorId: String?): String {
        val ip = ClientIpResolver.resolve(request)
        val safeVisitor = visitorId?.trim().orEmpty()
        return Sha256Hex.hash("$ip:$safeVisitor")
    }
}
