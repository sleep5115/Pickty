package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateDetailResponse
import com.pickty.server.domain.tier.dto.TemplateResponse
import com.pickty.server.domain.tier.dto.TemplateSummaryResponse
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class TierTemplateService(
    private val tierTemplateRepository: TierTemplateRepository,
) {

    fun listSummaries(): List<TemplateSummaryResponse> {
        val sort = Sort.by(Sort.Direction.DESC, "createdAt")
        return tierTemplateRepository.findAll(sort).map { e ->
            val id = e.id ?: throw IllegalStateException("template id missing")
            val items = e.items
            val itemCount = countItemsInPayload(items)
            val description = (items["description"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
            val persisted = normalizeThumbnailUrls(e.thumbnailUrls)
            val thumbnailUrls = resolveCardThumbnailUrls(e.listThumbnailUsesCustom, persisted, items)
            TemplateSummaryResponse(
                id = id,
                title = e.title,
                version = e.version,
                itemCount = itemCount,
                description = description,
                thumbnailUrls = thumbnailUrls,
                listThumbnailUsesCustom = e.listThumbnailUsesCustom,
            )
        }
    }

    fun getById(id: UUID): TemplateDetailResponse {
        val e = tierTemplateRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }
        return TemplateDetailResponse(
            id = e.id ?: throw IllegalStateException("template id missing"),
            title = e.title,
            version = e.version,
            parentTemplateId = e.parent?.id,
            items = e.items,
            thumbnailUrls = resolveCardThumbnailUrls(
                e.listThumbnailUsesCustom,
                normalizeThumbnailUrls(e.thumbnailUrls),
                e.items,
            ),
            listThumbnailUsesCustom = e.listThumbnailUsesCustom,
        )
    }

    @Transactional
    fun create(request: CreateTemplateRequest, creatorId: Long?): TemplateResponse {
        val parent = request.parentTemplateId?.let { pid ->
            tierTemplateRepository.findById(pid)
                .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "parent template not found") }
        }

        val thumbs = normalizeThumbnailUrls(request.thumbnailUrls)
        val entity = TierTemplate(
            title = request.title.trim(),
            itemsPayload = request.items,
            version = if (parent != null) parent.version + 1 else 1,
            parentTemplate = parent,
            creatorId = creatorId,
        )
        entity.listThumbnailUsesCustom = request.listThumbnailUsesCustom
        if (thumbs.isNotEmpty()) {
            entity.thumbnailUrls = thumbs
        }
        val saved = tierTemplateRepository.save(entity)
        val id = saved.id ?: throw IllegalStateException("template id missing after save")
        return TemplateResponse(
            id = id,
            title = saved.title,
            version = saved.version,
            parentTemplateId = saved.parent?.id,
            creatorId = saved.creatorId,
        )
    }

    private fun countItemsInPayload(items: Map<String, Any?>): Int {
        val raw = items["items"] ?: return 0
        return if (raw is List<*>) raw.size else 0
    }

    private fun normalizeThumbnailUrls(raw: List<String>?): List<String> {
        if (raw.isNullOrEmpty()) return emptyList()
        return raw.asSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .filter { it.startsWith("https://", ignoreCase = true) || it.startsWith("http://", ignoreCase = true) }
            .distinct()
            .take(4)
            .toList()
    }

    /**
     * - [usesCustomListThumbnail] true: 카드는 커스텀 커버 한 장만(`persisted` 첫 URL). 비어 있으면 items에서 보완.
     * - false: `persisted`가 비면 items 최대 4개. 여러 개면 아이템 그리드로 간주하되,
     *   레거시(옛 클라이언트 버그)로 커스텀+아이템이 섞인 경우 선두 URL이 어떤 아이템 `imageUrl`과도 같지 않으면 첫 URL만.
     */
    private fun resolveCardThumbnailUrls(
        usesCustomListThumbnail: Boolean,
        persisted: List<String>,
        items: Map<String, Any?>,
    ): List<String> {
        if (usesCustomListThumbnail) {
            return when {
                persisted.isNotEmpty() -> listOf(persisted.first())
                else -> httpImageUrlsFromItems(items, max = 4)
            }
        }
        if (persisted.isEmpty()) return httpImageUrlsFromItems(items, max = 4)
        if (persisted.size == 1) return persisted
        val itemUrls = httpImageUrlsFromItems(items, max = 256).toSet()
        val lead = persisted.first()
        return if (lead !in itemUrls) listOf(lead) else persisted
    }

    @Suppress("UNCHECKED_CAST")
    private fun httpImageUrlsFromItems(items: Map<String, Any?>, max: Int): List<String> {
        val raw = items["items"] ?: return emptyList()
        if (raw !is List<*>) return emptyList()
        val out = ArrayList<String>(max)
        for (entry in raw) {
            if (out.size >= max) break
            if (entry !is Map<*, *>) continue
            val map = entry as Map<String, Any?>
            val url = httpUrlFromItemMap(map) ?: continue
            out.add(url)
        }
        return out
    }

    /** JSONB 역직렬화 시 값이 String 이 아닐 수 있어 방어 */
    private fun httpUrlFromItemMap(map: Map<String, Any?>): String? {
        val raw = map["imageUrl"] ?: map["image_url"] ?: return null
        val t = when (raw) {
            is String -> raw.trim()
            else -> raw.toString().trim()
        }
        if (t.isEmpty()) return null
        if (!t.startsWith("https://", ignoreCase = true) && !t.startsWith("http://", ignoreCase = true)) {
            return null
        }
        return t
    }
}
