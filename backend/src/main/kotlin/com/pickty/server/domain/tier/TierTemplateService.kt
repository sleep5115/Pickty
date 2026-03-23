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
            val thumbnailUrls = when {
                persisted.isNotEmpty() -> persisted
                else -> httpImageUrlsFromItems(items, max = 4)
            }
            TemplateSummaryResponse(
                id = id,
                title = e.title,
                version = e.version,
                itemCount = itemCount,
                description = description,
                thumbnailUrls = thumbnailUrls,
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
            thumbnailUrls = normalizeThumbnailUrls(e.thumbnailUrls).ifEmpty {
                httpImageUrlsFromItems(e.items, max = 4)
            },
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
