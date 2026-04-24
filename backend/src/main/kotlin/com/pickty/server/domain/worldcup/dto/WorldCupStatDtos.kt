package com.pickty.server.domain.worldcup.dto
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotEmpty
import jakarta.validation.constraints.NotNull

/** 한 판 종료 후 통계만 전송 — 플레이 원시 이력 없음 */
data class WorldCupResultSubmitRequest(
    @field:NotNull
    val winnerItemId: Long,
    /**
     * 선택한 출전 인원(2, 4, 8, 16, …) — N강 진출 `reached_*` 임계·조합이 이 값에 맞게 적용됨
     */
    @field:NotNull @field:Min(2) @field:Max(4096)
    val startBracket: Long,
    @field:NotEmpty @field:Valid
    val rows: List<WorldCupStatSubmitRow>,
)

data class WorldCupStatSubmitRow(
    @field:NotNull @field:Min(1)
    val itemId: Long,
    /**
     * 한 판에서의 **최종** 성과. 1=우승, 2=결승 패, 4/8/16/32/…=해당 N강에서의 탈락(승리해 다음 풀에 갔다면 R/2 기록).
     * `reached_16/8/4/결승` 는 `startBracket`·이 값·승리 진출 규칙에 따라 1:1에만 가산한다.
     */
    @field:NotNull @field:Min(1) @field:Max(4096)
    val peakBracketSize: Int,
    val winCount: Long = 0,
    val matchCount: Long = 0,
    val rerolledCount: Long = 0,
    val droppedCount: Long = 0,
    val keptBothCount: Long = 0,
)

data class WorldCupRankingRowResponse(
    val rank: Int,
    /** 템플릿 로컬 아이템 정수 id */
    val itemId: Long,
    val matchCount: Long,
    val winCount: Long,
    val rerolledCount: Long,
    val droppedCount: Long,
    val keptBothCount: Long,
    val finalWinCount: Long,
    /** 플레이당 1회씩 — 해당 라운드 규모 이상 도달한 횟수(동일 플레이에서 중복 없음) */
    val reached16Count: Long,
    val reached8Count: Long,
    val reached4Count: Long,
    val reachedFinalCount: Long,
    /** 승리 횟수 ÷ 맞대결 참가 수 × 100 (반올림) */
    val winRatePct: Int,
    /** 해당 아이템 최종 우승 횟수 ÷ 같은 템플릿 완료 플레이(게임) 총 횟수 × 100 */
    val championshipRatePct: Int,
    /** 리롤(교체)당함 횟수 ÷ 맞대결 참가 수 × 100 */
    val skipRatePct: Int,
    /** 둘 다 탈락 참여 횟수 ÷ 맞대결 참가 수 × 100 */
    val dropRatePct: Int,
    /** 둘 다 올림 참여 횟수 ÷ 맞대결 참가 수 × 100 */
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
