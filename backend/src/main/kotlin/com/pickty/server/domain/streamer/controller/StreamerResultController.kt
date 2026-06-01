package com.pickty.server.domain.streamer.controller

import com.pickty.server.domain.streamer.dto.StreamerResultDetail
import com.pickty.server.domain.streamer.dto.StreamerResultListItem
import com.pickty.server.domain.streamer.repository.StreamerSessionResultRepository
import com.pickty.server.global.security.resolveUserIdOrThrow
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/**
 * 방장 본인의 종료된 스트리밍 세션 결과 조회 — '내 스트리밍'.
 * 로그인 사용자의 `hostUserId` 소유 결과만 노출한다.
 */
@RestController
@RequestMapping("/api/v1/streamer/results")
class StreamerResultController(
    private val resultRepository: StreamerSessionResultRepository,
) {

    @GetMapping("/my")
    fun myResults(authentication: Authentication?): ResponseEntity<List<StreamerResultListItem>> {
        val userId = resolveUserIdOrThrow(authentication)
        val items = resultRepository.findByHostUserIdOrderByFinishedAtDesc(userId).map { r ->
            StreamerResultListItem(
                id = r.id!!,
                templateType = r.templateType,
                templateId = r.templateId,
                finishReason = r.finishReason,
                tierSubmissions = (r.summary["tierSubmissions"] as? Number)?.toLong() ?: 0L,
                startedAt = r.startedAt,
                finishedAt = r.finishedAt,
            )
        }
        return ResponseEntity.ok(items)
    }

    @GetMapping("/{id}")
    fun resultDetail(
        @PathVariable id: Long,
        authentication: Authentication?,
    ): ResponseEntity<StreamerResultDetail> {
        val userId = resolveUserIdOrThrow(authentication)
        val r = resultRepository.findByIdAndHostUserId(id, userId)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "result not found")
        return ResponseEntity.ok(
            StreamerResultDetail(
                id = r.id!!,
                templateType = r.templateType,
                templateId = r.templateId,
                finishReason = r.finishReason,
                startedAt = r.startedAt,
                finishedAt = r.finishedAt,
                summary = r.summary,
            ),
        )
    }
}
