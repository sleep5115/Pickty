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
            val thumbnailUrl = firstHttpImageUrl(items)
            TemplateSummaryResponse(
                id = id,
                title = e.title,
                version = e.version,
                itemCount = itemCount,
                description = description,
                thumbnailUrl = thumbnailUrl,
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

    @Suppress("UNCHECKED_CAST")
    private fun firstHttpImageUrl(items: Map<String, Any?>): String? {
        val raw = items["items"] ?: return null
        if (raw !is List<*>) return null
        for (entry in raw) {
            if (entry !is Map<*, *>) continue
            val map = entry as Map<String, Any?>
            val url = map["imageUrl"] as? String ?: continue
            val t = url.trim()
            if (t.startsWith("https://", ignoreCase = true) || t.startsWith("http://", ignoreCase = true)) {
                return t
            }
        }
        return null
    }
}
