package com.pickty.server.domain.community.support

import org.springframework.stereotype.Component

@Component
class CommunityHtmlSanitizer {
    /**
     * Startup 안정성을 최우선으로 두는 경량 서버측 2차 필터.
     * - script/style/object/embed 제거
     * - on* 이벤트 핸들러 제거
     * - javascript: / data:text/html URI 제거
     *
     * NOTE: 정교한 allowlist sanitizer는 프론트 sanitize와 함께 별도 모듈로 교체 가능.
     */
    fun sanitize(rawHtml: String): String {
        var out = rawHtml
        out = out.replace(Regex("(?is)<\\s*(script|style|object|embed)[^>]*>.*?<\\s*/\\s*\\1\\s*>"), "")
        out = out.replace(Regex("(?is)<\\s*(script|style|object|embed)[^>]*/\\s*>"), "")
        out = out.replace(Regex("(?i)\\son[a-z]+\\s*=\\s*\"[^\"]*\""), "")
        out = out.replace(Regex("(?i)\\son[a-z]+\\s*=\\s*'[^']*'"), "")
        out = out.replace(Regex("(?i)\\son[a-z]+\\s*=\\s*[^\\s>]+"), "")
        out = out.replace(Regex("(?i)(href|src)\\s*=\\s*\"\\s*(javascript:|data:text/html)[^\"]*\""), "$1=\"#\"")
        out = out.replace(Regex("(?i)(href|src)\\s*=\\s*'\\s*(javascript:|data:text/html)[^']*'"), "$1='#'")
        return out
    }
}