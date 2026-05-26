package com.pickty.server.domain.streamer.service

/**
 * 시청자 폴링 주기를 동접자 수에 따라 결정.
 * 클라이언트가 현재 사용 중인 interval(초)을 보내면, 임계치 진동 방지(Hysteresis)
 * 정책을 적용해 다음 polling interval을 돌려준다.
 *
 * 임계치 (기획 3.2):
 *  - 3s → 6s 전환: 1050 이상
 *  - 6s → 3s 복귀: 950 이하
 *  - 6s → 10s 전환: 3150 이상
 *  - 10s → 6s 복귀: 2850 이하
 */
object StreamerPollBackoff {

    const val MIN_INTERVAL_SECONDS = 3
    const val MID_INTERVAL_SECONDS = 6
    const val MAX_INTERVAL_SECONDS = 10

    private val ALLOWED = setOf(MIN_INTERVAL_SECONDS, MID_INTERVAL_SECONDS, MAX_INTERVAL_SECONDS)

    fun nextInterval(currentInterval: Int, activeUserCount: Long): Int {
        val safeCurrent = if (currentInterval in ALLOWED) currentInterval else MIN_INTERVAL_SECONDS
        return when (safeCurrent) {
            MIN_INTERVAL_SECONDS ->
                if (activeUserCount >= UP_3_TO_6) MID_INTERVAL_SECONDS else MIN_INTERVAL_SECONDS
            MID_INTERVAL_SECONDS ->
                when {
                    activeUserCount >= UP_6_TO_10 -> MAX_INTERVAL_SECONDS
                    activeUserCount <= DOWN_6_TO_3 -> MIN_INTERVAL_SECONDS
                    else -> MID_INTERVAL_SECONDS
                }
            MAX_INTERVAL_SECONDS ->
                if (activeUserCount <= DOWN_10_TO_6) MID_INTERVAL_SECONDS else MAX_INTERVAL_SECONDS
            else -> MIN_INTERVAL_SECONDS
        }
    }

    private const val UP_3_TO_6 = 1050L
    private const val DOWN_6_TO_3 = 950L
    private const val UP_6_TO_10 = 3150L
    private const val DOWN_10_TO_6 = 2850L
}
