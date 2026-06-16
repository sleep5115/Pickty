package com.pickty.server.domain.ai.scheduler

import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AiMediaType
import com.pickty.server.domain.ai.service.AiApiUsageService
import com.pickty.server.domain.ai.service.AiGenerationService.ImageTopicKind
import com.pickty.server.domain.ai.service.AiGenerationService
import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateItemPayload
import com.pickty.server.domain.tier.repository.TierTemplateRepository
import com.pickty.server.domain.tier.service.TierTemplateService
import com.pickty.server.domain.upload.service.R2ImageStorageService
import com.pickty.server.domain.upload.service.RemoteImageFetcher
import com.pickty.server.domain.upload.support.Thumbnail2x2Composer
import com.pickty.server.domain.worldcup.dto.CreateWorldCupTemplateRequest
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import com.pickty.server.domain.worldcup.service.WorldCupTemplateService
import com.pickty.server.global.exception.AiQuotaExhaustedException
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * 매일 KST 18:13, Pixabay/Pexels 중심 이미지로 티어 1개 + 월드컵 1개를 자동 생성한다.
 *
 * 흐름(각 종류별): Gemini로 가벼운 실물 주제·아이템 → Pixabay/Pexels 이미지 검색 →
 * 받은 이미지를 다운로드·압축해 R2에 영속화([RemoteImageFetcher] + [R2ImageStorageService]) →
 * Pickty 호스팅 URL로 템플릿 생성. 외부 API는 트랜잭션 밖에서 끝내고 `create`에서만 영속화한다.
 *
 * - 시간대: KST 18:13(= UTC 09:13, 미국 새벽)이라 Gemini 글로벌 과부하(503)를 덜 맞는다. 정각·30분은 회피.
 * - 한 종류가 16개를 못 채우면(이미지 커버리지 미스) 다른 주제로 몇 번 더 시도한다(단발 취약성 제거).
 * - Gemini 일일 20회를 유튜브 배치(18:47)와 공유하므로, 이미지(검색 유입 가치 ↑)가 먼저 돌아 쿼터를 선점하되
 *   [IMAGE_BATCH_GEMINI_CAP]까지만 쓰고 멈춰 유튜브 배치·수동 생성용 여유를 남긴다.
 */
@Component
class AiImageTemplateScheduler(
    private val aiGenerationService: AiGenerationService,
    private val aiApiUsageService: AiApiUsageService,
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

    private data class ImageItemsResult(
        val items: List<TemplateItemPayload>,
        /** 앞쪽 최대 4개 아이템의 압축 JPEG — 티어 2×2 콜라주 썸네일 합성용 */
        val thumbnailJpegs: List<ByteArray>,
    )

    @Scheduled(cron = "0 13 18 * * *", zone = "Asia/Seoul")
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

    /**
     * 16개를 채우는 주제가 나올 때까지 최대 [MAX_TOPIC_ATTEMPTS]회 다른 주제로 시도한다.
     * 단, Gemini 일일 사용량이 [IMAGE_BATCH_GEMINI_CAP]에 도달하면 더 시작하지 않는다(20회 보호).
     */
    private fun generateOne(kind: Kind, excluded: MutableList<String>) {
        repeat(MAX_TOPIC_ATTEMPTS) { attempt ->
            val geminiUsed = aiApiUsageService.getTodayUsagePt().gemini
            if (geminiUsed >= IMAGE_BATCH_GEMINI_CAP) {
                log.info(
                    "AI image generator: Gemini usage {} ≥ cap {}; stop attempting {} (preserve budget)",
                    geminiUsed, IMAGE_BATCH_GEMINI_CAP, kind,
                )
                return
            }

            val topic = aiGenerationService.generateImageTopic(
                excludedTitles = excluded,
                targetKind = if (kind == Kind.WORLDCUP) ImageTopicKind.WORLDCUP else ImageTopicKind.TIER,
            )
            excluded.add(topic.title)

            val result = buildImageItems(topic.title, minOf(topic.itemCount, MAX_ITEMS))
            if (result.items.size >= MIN_ITEMS) {
                persist(kind, topic.title, result)
                return
            }
            log.info(
                "AI image generator: subject '{}' yielded only {} items with images (<{}); attempt {}/{} for {}",
                topic.title, result.items.size, MIN_ITEMS, attempt + 1, MAX_TOPIC_ATTEMPTS, kind,
            )
        }
        log.info("AI image generator: gave up on {} after {} topic attempts", kind, MAX_TOPIC_ATTEMPTS)
    }

    private fun persist(kind: Kind, subject: String, result: ImageItemsResult) {
        val items = result.items
        when (kind) {
            Kind.WORLDCUP -> {
                val title = "$TITLE_PREFIX$subject 월드컵".take(MAX_TITLE_LEN)
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
                val title = "$TITLE_PREFIX$subject 티어표".take(MAX_TITLE_LEN)
                val saved = tierTemplateService.create(
                    CreateTemplateRequest(
                        title = title,
                        description = null,
                        items = items,
                        parentTemplateId = null,
                        // 수동 생성과 동일한 2×2 콜라주 규칙. 합성 실패 시에만 첫 아이템 이미지로 폴백.
                        thumbnailUrl = composeTierThumbnailUrl(result.thumbnailJpegs) ?: items.first().imageUrl,
                        boardConfig = null,
                    ),
                    creatorId = creatorId,
                )
                log.info("AI image generator: created tier '{}' ({}) with {} items", saved.title, saved.id, items.size)
            }
        }
    }

    /**
     * 주제로 아이템 이름을 생성하고, 각 아이템의 검색 이미지를 다운로드·압축해 R2에 저장한 뒤
     * Pickty 호스팅 URL을 바인딩한다. 이미지가 없거나 저장에 실패한 아이템은 버린다.
     */
    private fun buildImageItems(subject: String, requestCount: Int): ImageItemsResult {
        val rows = aiGenerationService.autoGenerate(
            AiAutoGenerateRequest(prompt = subject, mediaType = AiMediaType.PHOTO, count = requestCount),
        )
        val items = ArrayList<TemplateItemPayload>()
        val thumbnailJpegs = ArrayList<ByteArray>(4)
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
            if (thumbnailJpegs.size < 4) {
                thumbnailJpegs.add(jpeg)
            }
            items.add(
                TemplateItemPayload(
                    id = id++,
                    name = row.name.take(MAX_ITEM_NAME_LEN),
                    imageUrl = r2ImageStorageService.publicUrlForStoredName(storedName),
                ),
            )
        }
        return ImageItemsResult(items, thumbnailJpegs)
    }

    /** 앞쪽 4개 아이템 JPEG로 2×2 콜라주를 합성·R2 영속화해 공개 URL 반환. 합성·저장 실패 시 null. */
    private fun composeTierThumbnailUrl(thumbnailJpegs: List<ByteArray>): String? {
        val composite = Thumbnail2x2Composer.composeJpeg(thumbnailJpegs) ?: return null
        return try {
            r2ImageStorageService.publicUrlForStoredName(r2ImageStorageService.storeCompressedJpeg(composite))
        } catch (e: Exception) {
            log.warn("AI image generator: tier thumbnail composite store failed", e)
            null
        }
    }

    /** 중복 주제 방지 — 최근 AI 생성 제목(삭제 포함)에서 접두/접미어를 떼어 비교 대상으로. */
    private fun recentSubjects(): List<String> {
        val tier = tierTemplateRepository.findAllByTitleStartingWithOrderByCreatedAtDesc(TITLE_PREFIX)
            .map { it.title }
        val worldcup = worldCupTemplateRepository.findAllByTitleStartingWithOrderByCreatedAtDesc(TITLE_PREFIX)
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
        // 한 종류(티어/월드컵)당 16개 채우는 주제가 나올 때까지 다른 주제로 재시도하는 최대 횟수.
        private const val MAX_TOPIC_ATTEMPTS = 3
        // 이미지 배치가 쓸 Gemini 일일 호출 상한(전체 20). 초과 전에 멈춰 유튜브 배치·수동 생성용 여유 확보.
        private const val IMAGE_BATCH_GEMINI_CAP = 12L
        private const val MAX_ITEM_NAME_LEN = 100
        private const val MAX_TITLE_LEN = 100
        private const val RECENT_TITLE_LIMIT = 150
        private const val TITLE_PREFIX = "[AI생성] "
        private const val LAYOUT_MODE = "split_diagonal"
    }
}
