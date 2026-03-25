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
            TemplateSummaryResponse(
                id = id,
                title = e.title,
                version = e.version,
                itemCount = itemCount,
                description = description,
                thumbnailUrl = normalizeThumbnailUrl(e.thumbnailUrl),
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
            thumbnailUrl = normalizeThumbnailUrl(e.thumbnailUrl),
        )
    }

    @Transactional
    fun create(request: CreateTemplateRequest, creatorId: Long?): TemplateResponse {
        val parent = request.parentTemplateId?.let { pid ->
            tierTemplateRepository.findById(pid)
                .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "parent template not found") }
        }

        val entity = TierTemplate(
            title = request.title.trim(),
            itemsPayload = request.items,
            version = if (parent != null) parent.version + 1 else 1,
            parentTemplate = parent,
            creatorId = creatorId,
        )
        entity.thumbnailUrl = request.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
        val saved = tierTemplateRepository.save(entity)
        tierTemplateRepository.flush()
        val id = saved.id ?: throw IllegalStateException("template id missing after save")
        return TemplateResponse(
            id = id,
            title = saved.title,
            version = saved.version,
            parentTemplateId = saved.parent?.id,
            creatorId = saved.creatorId,
            thumbnailUrl = normalizeThumbnailUrl(saved.thumbnailUrl),
        )
    }

    private fun countItemsInPayload(items: Map<String, Any?>): Int {
        val raw = items["items"] ?: return 0
        return if (raw is List<*>) raw.size else 0
    }

    private fun normalizeThumbnailUrl(raw: String?): String? {
        val t = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        if (!t.startsWith("https://", ignoreCase = true) && !t.startsWith("http://", ignoreCase = true)) {
            return null
        }
        return t
    }
}
