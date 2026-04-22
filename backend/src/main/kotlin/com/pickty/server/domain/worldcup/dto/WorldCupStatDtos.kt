package com.pickty.server.domain.worldcup.dto

data class WorldCupResultSubmitRequest(
    val winnerItemId: String,
    val itemStats: Map<String, WorldCupItemStatPayload>,
)

data class WorldCupItemStatPayload(
    val matchCount: Long = 0,
    val winCount: Long = 0,
    val rerolledCount: Long = 0,
    val droppedCount: Long = 0,
    val keptBothCount: Long = 0,
)

data class WorldCupRankingRowResponse(
    val rank: Int,
    val itemId: String,
    val matchCount: Long,
    val winCount: Long,
    val rerolledCount: Long,
    val droppedCount: Long,
    val keptBothCount: Long,
    val finalWinCount: Long,
    /** 승리 횟수 ÷ 맞대결 참가 수 × 100 (반올림) */
    val winRatePct: Int,
    /** 해당 아이템 최종 우승 횟수 ÷ 같은 템플릿 완료 플레이(게임) 총 횟수 × 100 */
    val championshipRatePct: Int,
    /** 리롤(교체)당함 횟수 ÷ 맞대결 참가 수 × 100 */
    val skipRatePct: Int,
    /** 둘 다 탈락 참여 횟수 ÷ 맞대결 참가 수 × 100 */
    val dropRatePct: Int,
    /** 둘 다 올리기 참여 횟수 ÷ 맞대결 참가 수 × 100 */
    val nailBiterRatePct: Int,
)

/** `GET …/ranking` — Spring `Page` 와 동일 키 + 분수 표기용 전체 완료 플레이 수 */
data class WorldCupRankingPageResponse(
    /** 모든 후보 `finalWinCount` 합 = 이 템플릿으로 끝까지 완료된 게임 수 */
    val totalCompletedPlays: Long,
    val content: List<WorldCupRankingRowResponse>,
    val totalElements: Long,
    val totalPages: Int,
    val size: Int,
    val number: Int,
    val first: Boolean,
    val last: Boolean,
    val empty: Boolean,
)
