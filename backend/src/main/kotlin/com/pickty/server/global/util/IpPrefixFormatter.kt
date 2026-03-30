package com.pickty.server.global.util

/**
 * 디시 스타일 표시용: IPv4 는 앞 **두 옥텟**만 (예 `118.235.11.22` → `118.235`).
 * IPv6 는 콜론으로 나뉜 비어 있지 않은 **앞 두 그룹**을 사용한다.
 */
object IpPrefixFormatter {
    fun firstTwoSegments(clientIp: String): String? {
        val ip = clientIp.trim()
        if (ip.isEmpty() || ip == "unknown") return null

        if (ip.contains('.')) {
            val parts = ip.split('.').map { it.trim() }.filter { it.isNotEmpty() }
            if (parts.size >= 2) return "${parts[0]}.${parts[1]}"
            return null
        }

        val groups = ip.split(':').map { it.trim() }.filter { it.isNotEmpty() }
        if (groups.size >= 2) return "${groups[0]}:${groups[1]}"
        return null
    }
}
