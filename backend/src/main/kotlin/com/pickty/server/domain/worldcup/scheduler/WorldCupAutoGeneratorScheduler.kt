package com.pickty.server.domain.worldcup.scheduler

import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.service.AiApiUsageService
import com.pickty.server.domain.ai.service.AiGenerationService
import com.pickty.server.domain.tier.dto.TemplateItemPayload
import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.dto.CreateWorldCupTemplateRequest
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import com.pickty.server.domain.worldcup.service.WorldCupTemplateService
import com.pickty.server.global.exception.AiQuotaExhaustedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 매일 KST 5:30, 유튜브 Data API 일일 무료 쿼터가 남아 있는 만큼 서로 다른 주제의 이상형 월드컵을 자동 생성한다.
 *
 * 한 주제는 자연 아이템 수만큼만 만들고(억지 패딩 없음), 남은 예산으로 다음 주제를 이어서 생성한다.
 * 외부 API(Gemini 주제/아이템 생성, 유튜브 검색)는 트랜잭션 밖에서 끝낸 뒤, 영속화는 메서드 단위
 * `@Transactional`인 [WorldCupTemplateService.create] 에서만 일어나도록 한다(커넥션 풀 점유 방지).
 */
@Component
class WorldCupAutoGeneratorScheduler(
    private val aiGenerationService: AiGenerationService,
    private val aiApiUsageService: AiApiUsageService,
    private val worldCupTemplateService: WorldCupTemplateService,
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    @Value("\${pickty.ai.auto-generator.enabled:true}") private val enabled: Boolean,
    @Value("\${pickty.ai.auto-generator.youtube-daily-quota:100}") private val youtubeDailyQuota: Int,
    @Value("\${pickty.ai.auto-generator.creator-id:2}") private val creatorId: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    // KST 18:47 (= UTC 09:47) — 미국 새벽(PT 02:47)이라 Gemini 글로벌 과부하(503)를 덜 맞는 시간대.
    // 정각·30분은 트래픽이 몰리기 쉬워 어중간한 분(:47)으로 둔다. 이미지 배치(18:13)보다 뒤에 돌린다.
    @Scheduled(cron = "0 47 18 * * *", zone = "Asia/Seoul")
    fun generateDaily() {
        if (!enabled) {
            log.info("WorldCup auto-generator disabled; skipping run")
            return
        }
        try {
            run()
        } catch (e: AiQuotaExhaustedException) {
            log.warn("WorldCup auto-generator stopped early: Gemini daily quota exhausted", e)
        } catch (e: Exception) {
            log.error("WorldCup auto-generator run failed", e)
        }
    }

    private fun run() {
        val usedToday = aiApiUsageService.getTodayUsagePt().youtube
        var remaining = (youtubeDailyQuota.toLong() - usedToday).coerceAtLeast(0L).toInt()
        log.info(
            "WorldCup auto-generator start: dailyQuota={}, usedToday={}, remainingBudget={}",
            youtubeDailyQuota, usedToday, remaining,
        )
        if (remaining < MIN_ITEMS) {
            log.info("WorldCup auto-generator: remaining budget {} < {}; nothing to do", remaining, MIN_ITEMS)
            return
        }

        val excluded = recentTopicTitles().toMutableList()
        var created = 0
        var attempts = 0
        var consecutiveFailures = 0

        while (remaining >= MIN_ITEMS && attempts < MAX_TOPICS_PER_RUN) {
            attempts++
            try {
                val topic = aiGenerationService.generateTopic(excluded)
                excluded.add(topic.title)

                val requestCount = minOf(topic.itemCount, remaining, MAX_ITEMS)
                if (requestCount < MIN_ITEMS) {
                    log.info(
                        "WorldCup auto-generator: topic '{}' fits only {} items (<{}); stopping",
                        topic.title, requestCount, MIN_ITEMS,
                    )
                    break
                }

                val rows = aiGenerationService.autoGenerate(
                    AiAutoGenerateRequest(
                        prompt = topic.title,
                        mediaType = AiMediaType.YOUTUBE,
                        count = requestCount,
                    ),
                )
                // 유튜브 검색은 후보 0개여도 쿼터를 소모하므로 요청 수 기준으로 예산을 차감한다.
                remaining -= requestCount

                // 후보가 하나도 없는 아이템은 버리고(이미지/영상 없음), 최상위(0번) 후보를 바인딩한다.
                val usable = rows.mapNotNull { row ->
                    val url = row.candidates.firstOrNull()?.url?.trim()?.takeIf { it.isNotEmpty() }
                    if (url == null) null else row.name to url
                }
                if (usable.size < MIN_ITEMS) {
                    log.info(
                        "WorldCup auto-generator: topic '{}' yielded only {} usable items (<{}); discarding",
                        topic.title, usable.size, MIN_ITEMS,
                    )
                    consecutiveFailures = 0 // 시스템 오류가 아니라 약한 주제일 뿐 — 다음 주제 시도
                    continue
                }

                val items = usable.mapIndexed { idx, (name, url) ->
                    TemplateItemPayload(id = idx + 1, name = name.take(MAX_ITEM_NAME_LEN), imageUrl = url)
                }
                val title = (TITLE_PREFIX + topic.title).take(MAX_TITLE_LEN)

                val saved = worldCupTemplateService.create(
                    CreateWorldCupTemplateRequest(
                        title = title,
                        description = null,
                        thumbnailUrl = null, // create() 가 상위 2개 아이템으로 콤마 썸네일을 추론
                        layoutMode = LAYOUT_MODE,
                        items = items,
                    ),
                    creatorId = creatorId,
                )
                created++
                consecutiveFailures = 0
                log.info(
                    "WorldCup auto-generator: created '{}' ({}) with {} items; remainingBudget={}",
                    saved.title, saved.id, items.size, remaining,
                )
            } catch (e: AiQuotaExhaustedException) {
                log.warn("WorldCup auto-generator: Gemini quota exhausted mid-run; stopping", e)
                break
            } catch (e: Exception) {
                // 한 주제에서의 일시 오류(JSON 파싱·네트워크 등)는 그날 작업 전체를 죽이지 않도록 격리.
                consecutiveFailures++
                log.warn(
                    "WorldCup auto-generator: iteration failed ({} consecutive)",
                    consecutiveFailures, e,
                )
                if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    log.error(
                        "WorldCup auto-generator: {} consecutive failures; stopping run",
                        consecutiveFailures,
                    )
                    break
                }
            }
        }

        log.info("WorldCup auto-generator done: created={} template(s), remainingBudget={}", created, remaining)
    }

    /** 중복 주제 방지용 — 최근 ACTIVE 템플릿 제목에서 `[AI생성]` 접두사를 떼어 비교 대상으로 사용. */
    private fun recentTopicTitles(): List<String> =
        worldCupTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE)
            .asSequence()
            .map { it.title.removePrefix(TITLE_PREFIX).trim() }
            .filter { it.isNotEmpty() }
            .take(RECENT_TITLE_LIMIT)
            .toList()

    companion object {
        private const val MIN_ITEMS = 16
        private const val MAX_ITEMS = 100
        private const val MAX_TOPICS_PER_RUN = 20
        private const val MAX_CONSECUTIVE_FAILURES = 3
        private const val MAX_ITEM_NAME_LEN = 100
        private const val MAX_TITLE_LEN = 100
        private const val RECENT_TITLE_LIMIT = 100
        private const val TITLE_PREFIX = "[AI생성] "
        private const val LAYOUT_MODE = "split_diagonal"
    }
}
