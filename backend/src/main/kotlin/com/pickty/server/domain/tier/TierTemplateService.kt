package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.PatchTemplateMetaResponse
import com.pickty.server.domain.tier.dto.TemplateItemsPayload
import com.pickty.server.domain.tier.dto.TemplateDetailResponse
import com.pickty.server.domain.tier.dto.TemplateResponse
import com.pickty.server.domain.tier.dto.TemplateSummaryResponse
import com.pickty.server.domain.tier.dto.UpdateTemplateMetaRequest
import com.pickty.server.global.exception.PicktyValidationException
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class TierTemplateService(
    private val tierTemplateRepository: TierTemplateRepository,
) {

    fun listSummaries(): List<TemplateSummaryResponse> =
        tierTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE).map { e ->
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
                creatorId = e.creatorId,
            )
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
            creatorId = e.creatorId,
        )
    }

    @Transactional
    fun create(request: CreateTemplateRequest, creatorId: Long?): TemplateResponse {
        val parent = request.parentTemplateId?.let { pid ->
            tierTemplateRepository.findById(pid)
                .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "parent template not found") }
        }
        if (parent != null && parent.templateStatus == TemplateStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.GONE, "fork source template was removed")
        }

        val entity = TierTemplate(
            title = request.title.trim(),
            itemsPayload = templateItemsPayloadToMap(request.items),
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

    @Transactional
    fun patchTemplateMeta(
        id: UUID,
        request: UpdateTemplateMetaRequest,
        userId: Long,
        isAdmin: Boolean,
    ): PatchTemplateMetaResponse {
        val entity = tierTemplateRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }
        if (entity.templateStatus == TemplateStatus.DELETED) {
            throw PicktyValidationException(listOf("삭제된 템플릿은 수정할 수 없습니다."))
        }
        val ownerId = entity.creatorId
        val allowed = isAdmin || (ownerId != null && ownerId == userId)
        if (!allowed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not owner")
        }
        val desc = request.description?.trim()?.takeIf { it.isNotEmpty() }
        entity.applyTemplateMeta(request.title.trim(), desc)
        tierTemplateRepository.flush()
        val tid = entity.id ?: throw IllegalStateException("template id missing")
        val descriptionOut = (entity.items["description"] as? String)?.trim()?.takeIf { it.isNotEmpty() }
        return PatchTemplateMetaResponse(
            id = tid,
            title = entity.title,
            version = entity.version,
            description = descriptionOut,
        )
    }

    @Transactional
    fun delete(id: UUID, userId: Long, isAdmin: Boolean) {
        val entity = tierTemplateRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }
        val ownerId = entity.creatorId
        val allowed = isAdmin || (ownerId != null && ownerId == userId)
        if (!allowed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not allowed")
        }
        if (entity.templateStatus == TemplateStatus.DELETED) {
            return
        }
        entity.markDeleted()
    }

    private fun templateItemsPayloadToMap(payload: TemplateItemsPayload): Map<String, Any?> {
        val rows = payload.items.map { row ->
            buildMap<String, Any?> {
                put("id", row.id)
                put("name", row.name)
                row.imageUrl?.trim()?.takeIf { it.isNotEmpty() }?.let { put("imageUrl", it) }
            }
        }
        return buildMap {
            payload.description?.trim()?.takeIf { it.isNotEmpty() }?.let { put("description", it) }
            put("items", rows)
        }
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
