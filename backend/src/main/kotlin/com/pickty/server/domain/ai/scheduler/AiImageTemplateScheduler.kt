package com.pickty.server.domain.ai.scheduler

import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.service.AiGenerationService
import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateItemPayload
import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.tier.repository.TierTemplateRepository
import com.pickty.server.domain.tier.service.TierTemplateService
import com.pickty.server.domain.upload.service.R2ImageStorageService
import com.pickty.server.domain.upload.service.RemoteImageFetcher
import com.pickty.server.domain.worldcup.dto.CreateWorldCupTemplateRequest
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import com.pickty.server.domain.worldcup.service.WorldCupTemplateService
import com.pickty.server.global.exception.AiQuotaExhaustedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 매일 KST 5:00, **Wikimedia 이미지**로 티어 1개 + 월드컵 1개를 자동 생성한다.
 *
 * 흐름(각 종류별): Gemini로 위키 친화 주제·아이템 → Wikimedia 이미지 검색 →
 * 받은 이미지를 다운로드·압축해 R2에 영속화([RemoteImageFetcher] + [R2ImageStorageService]) →
 * Pickty 호스팅 URL로 템플릿 생성. 외부 API는 트랜잭션 밖에서 끝내고 `create`에서만 영속화한다.
 *
 * Gemini 일일 20회를 유튜브 월드컵 배치(5:30)와 공유하므로 더 이른 5:00에 두어 쿼터를 선점한다.
 */
@Component
class AiImageTemplateScheduler(
    private val aiGenerationService: AiGenerationService,
    private val tierTemplateService: TierTemplateService,
    private val worldCupTemplateService: WorldCupTemplateService,
    private val tierTemplateRepository: TierTemplateRepository,
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    private val remoteImageFetcher: RemoteImageFetcher,
    private val r2ImageStorageService: R2ImageStorageService,
    @Value("\${pickty.ai.auto-generator.image.enabled:true}") private val enabled: Boolean,
    @Value("\${pickty.ai.auto-generator.creator-id:2}") private val creatorId: Long,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    private enum class Kind { WORLDCUP, TIER }

    @Scheduled(cron = "0 0 5 * * *", zone = "Asia/Seoul")
    fun generateDaily() {
        if (!enabled) {
            log.info("AI image template generator disabled; skipping run")
            return
        }
        val excluded = recentSubjects().toMutableList()
        for (kind in Kind.entries) {
            try {
                generateOne(kind, excluded)
            } catch (e: AiQuotaExhaustedException) {
                log.warn("AI image generator: Gemini quota exhausted; stopping run", e)
                break
            } catch (e: Exception) {
                log.error("AI image generator: {} generation failed", kind, e)
            }
        }
    }

    private fun generateOne(kind: Kind, excluded: MutableList<String>) {
        val topic = aiGenerationService.generateImageTopic(excluded)
        excluded.add(topic.title)

        val items = buildImageItems(topic.title, minOf(topic.itemCount, MAX_ITEMS))
        if (items.size < MIN_ITEMS) {
            log.info(
                "AI image generator: subject '{}' yielded only {} items with images (<{}); skipping {}",
                topic.title, items.size, MIN_ITEMS, kind,
            )
            return
        }

        when (kind) {
            Kind.WORLDCUP -> {
                val title = "$TITLE_PREFIX${topic.title} 월드컵".take(MAX_TITLE_LEN)
                val saved = worldCupTemplateService.create(
                    CreateWorldCupTemplateRequest(
                        title = title,
                        description = null,
                        thumbnailUrl = null, // create() 가 상위 2개 아이템으로 콤마 썸네일 추론
                        layoutMode = LAYOUT_MODE,
                        items = items,
                    ),
                    creatorId = creatorId,
                )
                log.info("AI image generator: created worldcup '{}' ({}) with {} items", saved.title, saved.id, items.size)
            }
            Kind.TIER -> {
                val title = "$TITLE_PREFIX${topic.title} 티어표".take(MAX_TITLE_LEN)
                val saved = tierTemplateService.create(
                    CreateTemplateRequest(
                        title = title,
                        description = null,
                        items = items,
                        parentTemplateId = null,
                        thumbnailUrl = items.first().imageUrl,
                        boardConfig = null,
                    ),
                    creatorId = creatorId,
                )
                log.info("AI image generator: created tier '{}' ({}) with {} items", saved.title, saved.id, items.size)
            }
        }
    }

    /**
     * 주제로 아이템 이름을 생성하고, 각 아이템의 Wikimedia 이미지를 다운로드·압축해 R2에 저장한 뒤
     * Pickty 호스팅 URL을 바인딩한다. 이미지가 없거나 저장에 실패한 아이템은 버린다.
     */
    private fun buildImageItems(subject: String, requestCount: Int): List<TemplateItemPayload> {
        val rows = aiGenerationService.autoGenerate(
            AiAutoGenerateRequest(prompt = subject, mediaType = AiMediaType.PHOTO, count = requestCount),
        )
        val items = ArrayList<TemplateItemPayload>()
        var id = 1
        for (row in rows) {
            val sourceUrl = row.candidates.firstOrNull()?.url?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            val jpeg = remoteImageFetcher.fetchAndCompressToJpeg(sourceUrl) ?: continue
            val storedName = try {
                r2ImageStorageService.storeCompressedJpeg(jpeg)
            } catch (e: Exception) {
                log.warn("AI image generator: R2 store failed for item '{}'", row.name, e)
                continue
            }
            items.add(
                TemplateItemPayload(
                    id = id++,
                    name = row.name.take(MAX_ITEM_NAME_LEN),
                    imageUrl = r2ImageStorageService.publicUrlForStoredName(storedName),
                ),
            )
        }
        return items
    }

    /** 중복 주제 방지 — 최근 티어·월드컵 ACTIVE 제목에서 접두/접미어를 떼어 비교 대상으로. */
    private fun recentSubjects(): List<String> {
        val tier = tierTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE)
            .map { it.title }
        val worldcup = worldCupTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE)
            .map { it.title }
        return (tier + worldcup)
            .asSequence()
            .map { it.removePrefix(TITLE_PREFIX).removeSuffix(" 월드컵").removeSuffix(" 티어표").trim() }
            .filter { it.isNotEmpty() }
            .distinct()
            .take(RECENT_TITLE_LIMIT)
            .toList()
    }

    companion object {
        private const val MIN_ITEMS = 16
        private const val MAX_ITEMS = 100
        private const val MAX_ITEM_NAME_LEN = 100
        private const val MAX_TITLE_LEN = 100
        private const val RECENT_TITLE_LIMIT = 150
        private const val TITLE_PREFIX = "[AI생성] "
        private const val LAYOUT_MODE = "split_diagonal"
    }
}
