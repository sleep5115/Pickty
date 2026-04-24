package com.pickty.server.domain.ai.dto

/**
 * 미디어 검색 후보 — [url]은 필수, [title]은 출처에 따라 없을 수 있음(예: 이미지 검색).
 */
data class MediaCandidate(
    val url: String,
    val title: String? = null,
)
