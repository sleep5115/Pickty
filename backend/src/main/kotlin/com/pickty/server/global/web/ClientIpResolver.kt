package com.pickty.server.global.web

import jakarta.servlet.http.HttpServletRequest

object ClientIpResolver {

    /**
     * 프록시 환경에서는 `X-Forwarded-For` 첫 번째 값을 우선한다.
     * 비회원 반응·댓글 IP 해시·표시용 prefix 의 입력으로 동일 규칙을 쓴다.
     */
    fun resolve(request: HttpServletRequest): String {
        val forwarded = request.getHeader("X-Forwarded-For")?.trim()?.takeIf { it.isNotEmpty() }
        if (forwarded != null) {
            return forwarded.split(',').first().trim()
        }
        return request.remoteAddr?.trim().takeUnless { it.isNullOrEmpty() } ?: "unknown"
    }
}
