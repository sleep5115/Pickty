package com.pickty.server.domain.profile.service

import com.pickty.server.domain.ai.service.AiApiUsageService
import com.pickty.server.domain.profile.dto.GamerProfileAiCard
import com.pickty.server.domain.profile.dto.GamerProfileAiGenerateResponse
import com.pickty.server.domain.profile.dto.GamerProfileStatResponse
import com.pickty.server.global.exception.AiQuotaExhaustedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.stereotype.Service
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientResponseException
import org.springframework.web.util.UriComponentsBuilder
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.URI

/**
 * 유저 자연어 한 줄을 Gemini 2.5 Flash **JSON Mode**(`responseMimeType=application/json`)로 파싱해
 * 게임 타이틀·표준 `game_slug`·스탯 목록의 구조화 카드로 변환한다.
 *
 * 마스터 게임 테이블이 아직 없으므로 아이콘은 매핑하지 않고(`isCustom=true`, `gameIconUrl=null`)
 * 표준 `gameSlug` 만 보존한다 — 추후 마스터 연동 시 slug 로 정식 키아트를 붙일 수 있다.
 *
 * 호출은 `AiApiUsageService` 로 집계되어 공용 Gemini 일일 한도(자동 생성 배치와 공유)에 합산된다.
 */
@Service
class GamerProfileAiService(
    @Value("\${pickty.ai.gemini.api-key:}") apiKeyRaw: String,
    private val aiApiUsageService: AiApiUsageService,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val objectMapper = jacksonObjectMapper()
    private val restClient = RestClient.builder().build()
    private val geminiApiKey: String = apiKeyRaw.trim()

    fun parseCards(text: String): GamerProfileAiGenerateResponse {
        val payload = callGeminiJson(buildPrompt(text.trim()))
        val games = payload.games
            .mapNotNull { it.toCardOrNull() }
            .take(MAX_CARDS)
        return GamerProfileAiGenerateResponse(games = games)
    }

    private fun AiGame.toCardOrNull(): GamerProfileAiCard? {
        val title = gameTitle.trim()
        val slug = gameSlug.trim().lowercase()
        if (title.isEmpty() || slug.isEmpty()) return null
        val parsedStats = stats
            .mapNotNull { s ->
                val k = s.statKey.trim()
                val v = s.statValue.trim()
                if (k.isEmpty() || v.isEmpty()) null else GamerProfileStatResponse(k, v)
            }
            .take(MAX_STATS_PER_CARD)
        return GamerProfileAiCard(
            gameTitle = title,
            gameSlug = slug,
            // 마스터 테이블 부재 — 전부 커스텀 취급(프론트가 프리셋 아이콘 렌더), slug 는 보존.
            isCustom = true,
            gameIconUrl = null,
            stats = parsedStats,
        )
    }

    private fun buildPrompt(text: String): String = """
        유저가 작성한 문장에서 언급된 모든 게임 정보를 파싱하여 아래 스키마의 JSON 으로만 반환하라.
        - gameTitle: 게임의 공식 명칭(한글 또는 영문). 예: 롤 -> League of Legends, 스타듀 -> Stardew Valley, 메이플 -> MapleStory
        - gameSlug: 해당 게임의 표준 영문 식별자(소문자, 단어는 대시로 연결). 예: league-of-legends, stardew-valley, maplestory, hollow-knight
          어떤 다국어/속어(롤, 리얼오브레전드, LOL, 英雄联盟 등)로 적혀 있어도 동일 게임이면 같은 slug 로 통일하라.
        - stats: 그 게임에 대해 문장에서 읽어낼 수 있는 스탯 목록. 각 항목은 statKey(예: 최고티어, 플레이시간, 레벨, 업적)와
          statValue(예: 다이아몬드, 2500시간, 260, 5문 클리어)를 가진다. 스탯이 불명확하면 빈 배열로 둔다.

        문장: "$text"

        반환 JSON 스키마:
        {
          "games": [
            { "gameTitle": "...", "gameSlug": "...", "stats": [ { "statKey": "...", "statValue": "..." } ] }
          ]
        }
    """.trimIndent()

    /**
     * Gemini generateContent 호출(JSON Mode). 쿼터 소진은 [AiQuotaExhaustedException]으로 즉시 실패,
     * 일시 5xx 는 짧은 백오프로 재시도, 그 외 HTTP 오류는 전파.
     */
    private fun callGeminiJson(promptText: String): AiPayload {
        val uri = UriComponentsBuilder.fromUriString(GEMINI_GENERATE_CONTENT_URI)
            .queryParam("key", geminiApiKey)
            .build()
            .toUri()

        val escapedPrompt = objectMapper.writeValueAsString(promptText)
        val jsonPayload =
            """{"contents":[{"parts":[{"text":$escapedPrompt}]}],"generationConfig":{"responseMimeType":"application/json"}}"""

        var attempt = 0
        while (true) {
            try {
                val text = executeGeminiPost(uri, jsonPayload)
                return objectMapper.readValue<AiPayload>(text)
            } catch (e: RestClientResponseException) {
                if (isQuotaExhausted(e)) {
                    log.warn("GamerProfile AI: Gemini daily quota exhausted HTTP {} — fast-fail", e.statusCode.value())
                    throw AiQuotaExhaustedException()
                }
                if (e.statusCode.is5xxServerError && attempt < GEMINI_TRANSIENT_RETRIES) {
                    attempt++
                    val backoffMs = GEMINI_RETRY_BASE_MS * (1L shl (attempt - 1))
                    log.warn("GamerProfile AI: Gemini HTTP {} transient — retry {}/{} after {}ms",
                        e.statusCode.value(), attempt, GEMINI_TRANSIENT_RETRIES, backoffMs)
                    Thread.sleep(backoffMs)
                    continue
                }
                throw e
            }
        }
    }

    private fun executeGeminiPost(uri: URI, jsonPayload: String): String {
        aiApiUsageService.recordGeminiGenerateContentCall()
        val response = restClient.post()
            .uri(uri)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .body(jsonPayload)
            .retrieve()
            .body(Map::class.java)

        val candidates = response?.get("candidates") as? List<*>
        val content = (candidates?.firstOrNull() as? Map<*, *>)?.get("content") as? Map<*, *>
        val parts = content?.get("parts") as? List<*>
        val text = (parts?.firstOrNull() as? Map<*, *>)?.get("text") as? String
            ?: throw IllegalStateException("Empty Gemini response")

        return text.trim().removePrefix("```json").removePrefix("```").removeSuffix("```").trim()
    }

    private fun isQuotaExhausted(e: RestClientResponseException): Boolean {
        val blob = (e.message ?: "") + "\n" + (e.responseBodyAsString ?: "")
        return blob.contains("GenerateRequestsPerDay") ||
            blob.contains("GenerateRequestsPerDayPerProjectPerModel-FreeTier")
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class AiPayload(
        val games: List<AiGame> = emptyList(),
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class AiGame(
        val gameTitle: String = "",
        val gameSlug: String = "",
        val stats: List<AiStat> = emptyList(),
    )

    @JsonIgnoreProperties(ignoreUnknown = true)
    private data class AiStat(
        val statKey: String = "",
        val statValue: String = "",
    )

    companion object {
        private const val GEMINI_GENERATE_CONTENT_URI =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent"
        private const val GEMINI_TRANSIENT_RETRIES = 2
        private const val GEMINI_RETRY_BASE_MS = 2000L
        private const val MAX_CARDS = 20
        private const val MAX_STATS_PER_CARD = 12
    }
}
