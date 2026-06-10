package com.pickty.server.domain.profile.service

import com.pickty.server.domain.profile.dto.GamerProfileGameStatsResponse
import com.pickty.server.domain.profile.dto.GamerProfileStatResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service

/**
 * 외부 게임 API(LoL Riot / 오버워치) 조회 연동.
 *
 * MVP 기준 API Key 미설정이거나 통신 실패 시 **예외를 터뜨리지 않고** 골드 티어 등
 * Mock 데이터를 채워 반환한다(`mock=true`). 실연동은 키 주입 후 단계적으로 확장한다.
 */
@Service
class GameStatsService(
    @Value("\${pickty.game-api.riot.api-key:}") riotApiKeyRaw: String,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val riotApiKey: String = riotApiKeyRaw.trim()

    fun fetch(gameSlug: String, identifier: String): GamerProfileGameStatsResponse {
        val slug = gameSlug.trim().lowercase()
        return try {
            when (slug) {
                "league-of-legends", "lol" -> fetchLol(identifier)
                "overwatch", "overwatch-2", "overwatch2" -> fetchOverwatch(identifier)
                else -> mockGeneric(slug)
            }
        } catch (e: Exception) {
            log.warn("GameStatsService fetch failed for slug={} — falling back to mock", slug, e)
            mockGeneric(slug)
        }
    }

    private fun fetchLol(identifier: String): GamerProfileGameStatsResponse {
        // Riot API Key 미설정 시 즉시 Mock. (실연동은 키 주입 후 확장)
        if (riotApiKey.isEmpty()) {
            return GamerProfileGameStatsResponse(
                gameSlug = "league-of-legends",
                gameTitle = "League of Legends",
                gameIconUrl = null,
                stats = listOf(
                    GamerProfileStatResponse("소환사명", identifier.trim()),
                    GamerProfileStatResponse("솔로랭크", "골드 4"),
                    GamerProfileStatResponse("승률", "52%"),
                    GamerProfileStatResponse("모스트 챔피언", "야스오"),
                ),
                mock = true,
            )
        }
        // TODO: riotApiKey 주입 시 실제 account-v1 / league-v4 호출로 교체
        throw NotImplementedError("Riot 실연동 미구현 — Mock fallback 사용")
    }

    private fun fetchOverwatch(identifier: String): GamerProfileGameStatsResponse =
        GamerProfileGameStatsResponse(
            gameSlug = "overwatch-2",
            gameTitle = "Overwatch 2",
            gameIconUrl = null,
            stats = listOf(
                GamerProfileStatResponse("배틀태그", identifier.trim()),
                GamerProfileStatResponse("경쟁전", "골드"),
                GamerProfileStatResponse("모스트 영웅", "트레이서"),
            ),
            mock = true,
        )

    private fun mockGeneric(slug: String): GamerProfileGameStatsResponse =
        GamerProfileGameStatsResponse(
            gameSlug = slug,
            gameTitle = slug,
            gameIconUrl = null,
            stats = listOf(GamerProfileStatResponse("티어", "골드")),
            mock = true,
        )
}
