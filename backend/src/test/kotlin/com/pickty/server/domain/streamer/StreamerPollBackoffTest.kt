package com.pickty.server.domain.streamer

import com.pickty.server.domain.streamer.service.StreamerPollBackoff
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class StreamerPollBackoffTest {

    @Test
    fun `3초 유지 - 임계치 미만`() {
        assertThat(StreamerPollBackoff.nextInterval(3, 0L)).isEqualTo(3)
        assertThat(StreamerPollBackoff.nextInterval(3, 1049L)).isEqualTo(3)
    }

    @Test
    fun `3초에서 6초 상향 - 1050 이상`() {
        assertThat(StreamerPollBackoff.nextInterval(3, 1050L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(3, 3000L)).isEqualTo(6)
    }

    @Test
    fun `6초 hysteresis - 950 이하만 3으로 복귀`() {
        assertThat(StreamerPollBackoff.nextInterval(6, 1000L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(6, 951L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(6, 950L)).isEqualTo(3)
        assertThat(StreamerPollBackoff.nextInterval(6, 0L)).isEqualTo(3)
    }

    @Test
    fun `6초에서 10초 상향 - 3150 이상`() {
        assertThat(StreamerPollBackoff.nextInterval(6, 3149L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(6, 3150L)).isEqualTo(10)
        assertThat(StreamerPollBackoff.nextInterval(6, 10_000L)).isEqualTo(10)
    }

    @Test
    fun `10초 hysteresis - 2850 이하만 6으로 복귀`() {
        assertThat(StreamerPollBackoff.nextInterval(10, 5000L)).isEqualTo(10)
        assertThat(StreamerPollBackoff.nextInterval(10, 2851L)).isEqualTo(10)
        assertThat(StreamerPollBackoff.nextInterval(10, 2850L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(10, 500L)).isEqualTo(6)
    }

    @Test
    fun `허용되지 않은 currentInterval은 3초로 안전화 후 일반 규칙 적용`() {
        // 클라가 임의 값을 보내도 서버는 안전한 baseline(3초)부터 시작하여 부하를 보호한다.
        assertThat(StreamerPollBackoff.nextInterval(0, 0L)).isEqualTo(3)
        assertThat(StreamerPollBackoff.nextInterval(-1, 1049L)).isEqualTo(3)
        assertThat(StreamerPollBackoff.nextInterval(99, 1050L)).isEqualTo(6)
        assertThat(StreamerPollBackoff.nextInterval(7, 5000L)).isEqualTo(6)
    }
}
