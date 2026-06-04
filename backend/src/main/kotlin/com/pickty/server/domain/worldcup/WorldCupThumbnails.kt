package com.pickty.server.domain.worldcup

/**
 * 월드컵 목록 카드 대표 썸네일(`worldcup_templates.thumbnail_url`) 헬퍼.
 *
 * - 카드 썸네일은 **정적 이미지 URL**이어야 한다. 유튜브 watch URL은 이미지가 아니므로
 *   `img.youtube.com/vi/{id}/hqdefault.jpg` 로 변환한다(프론트 `getYoutubeThumbnailUrl` 과 동일).
 * - 랭킹 1·2위 동적 썸네일은 **콤마(`,`) 구분 다중 URL** 포맷으로 저장한다(기획서 6장).
 *   프론트는 콤마 유무로 단일/좌우분할 렌더를 분기한다.
 */
object WorldCupThumbnails {

    /** 미디어 URL → 카드용 정적 이미지 썸네일 URL. 유튜브면 img.youtube.com, 그 외는 원본 그대로. */
    fun toThumbnailImageUrl(raw: String?): String? {
        val s = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        val vid = parseYoutubeVideoId(s)
        return if (vid != null) "https://img.youtube.com/vi/$vid/hqdefault.jpg" else s
    }

    /** 미디어 URL 목록에서 앞쪽 최대 2개를 썸네일로 변환해 콤마로 연결. 비거나 변환 실패한 항목은 건너뜀. */
    fun joinTop2(mediaUrls: List<String?>): String? {
        val parts = mediaUrls.asSequence()
            .mapNotNull { toThumbnailImageUrl(it) }
            .take(2)
            .toList()
        return parts.takeIf { it.isNotEmpty() }?.joinToString(",")
    }

    /** watch?v=, youtu.be/, shorts/, embed/ 등에서 11자 비디오 ID 추출 (프론트 parseYoutubeVideoId 미러). */
    fun parseYoutubeVideoId(raw: String): String? {
        val s = raw.trim()
        if (s.isEmpty()) return null
        val m = ID_FROM_URL.find(s) ?: return null
        return m.groupValues[1].takeIf { ID_PATTERN.matches(it) }
    }

    private val ID_PATTERN = Regex("[\\w-]{11}")
    private val ID_FROM_URL = Regex("(?:youtu\\.be/|[?&]v=|/embed/|/shorts/)([\\w-]{11})")
}
