package com.pickty.server.domain.streamer.web

import com.pickty.server.domain.streamer.service.StreamerSessionStateService
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

object StreamerHttpSupport {

    const val HEADER_HOST_TOKEN = "X-Host-Token"
    const val HEADER_NEXT_POLL_INTERVAL = "X-Next-Poll-Interval"
    const val HEADER_POLL_INTERVAL = "X-Poll-Interval"

    fun extractHostToken(request: HttpServletRequest): String {
        val raw = request.getHeader(HEADER_HOST_TOKEN)?.trim()
        if (raw.isNullOrEmpty()) {
            throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "host token missing")
        }
        return raw
    }

    fun requireHostToken(
        sessionStateService: StreamerSessionStateService,
        sessionId: UUID,
        request: HttpServletRequest,
    ): String {
        val token = extractHostToken(request)
        if (!sessionStateService.verifyHostToken(sessionId, token)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "host token mismatch")
        }
        return token
    }

    /**
     * `If-None-Match: "v5"` 형식에서 숫자 부분을 끌어낸다.
     */
    fun parseIfNoneMatchVersion(request: HttpServletRequest): Long? {
        val raw = request.getHeader("If-None-Match")?.trim() ?: return null
        val unquoted = raw.removeSurrounding("\"")
        val core = if (unquoted.startsWith("v")) unquoted.substring(1) else unquoted
        return core.toLongOrNull()
    }

    fun makeEtagHeader(version: Long): String = "\"v$version\""

    /**
     * `X-Poll-Interval` 헤더에서 클라이언트가 현재 사용 중인 간격(초)을 읽는다.
     * 유효 범위 밖이면 기본 3초.
     */
    fun extractClientPollInterval(request: HttpServletRequest): Int {
        val raw = request.getHeader(HEADER_POLL_INTERVAL)?.trim()?.toIntOrNull()
        return raw?.coerceIn(3, 10) ?: 3
    }
}
