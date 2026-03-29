package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateItemsPayload
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
    private val tierResultRepository: TierResultRepository,
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
                creatorId = e.creatorId,
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
    fun update(id: UUID, request: CreateTemplateRequest, userId: Long): TemplateResponse {
        val entity = tierTemplateRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }
        val ownerId = entity.creatorId
        if (ownerId == null || ownerId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not owner")
        }
        val itemsMap = templateItemsPayloadToMap(request.items)
        val thumb = request.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
        entity.replaceContent(request.title.trim(), itemsMap, thumb)
        tierTemplateRepository.flush()
        val tid = entity.id ?: throw IllegalStateException("template id missing")
        return TemplateResponse(
            id = tid,
            title = entity.title,
            version = entity.version,
            parentTemplateId = entity.parent?.id,
            creatorId = entity.creatorId,
            thumbnailUrl = normalizeThumbnailUrl(entity.thumbnailUrl),
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
        if (tierResultRepository.countByTemplate_Id(id) > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "이 템플릿을 사용한 티어표가 있어 삭제할 수 없습니다.",
            )
        }
        if (tierTemplateRepository.countByParent_Id(id) > 0) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "이 템플릿에서 파생된 템플릿이 있어 삭제할 수 없습니다.",
            )
        }
        tierTemplateRepository.delete(entity)
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
