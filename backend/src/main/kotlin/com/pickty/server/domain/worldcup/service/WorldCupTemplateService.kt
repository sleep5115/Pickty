package com.pickty.server.domain.worldcup.service

import com.pickty.server.domain.tier.dto.TemplateItemPayload
import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.dto.CreateWorldCupTemplateRequest
import com.pickty.server.domain.worldcup.dto.PatchWorldCupTemplateMetaResponse
import com.pickty.server.domain.worldcup.dto.UpdateWorldCupTemplateMetaRequest
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateCreatedResponse
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateDetailResponse
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateSummaryResponse
import com.pickty.server.domain.worldcup.entity.WorldCupTemplate
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class WorldCupTemplateService(
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
) {

    fun listSummaries(): List<WorldCupTemplateSummaryResponse> {
        val rows =
            worldCupTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE)
        return rows.map { it.toSummary() }
    }

    @Transactional(readOnly = true)
    fun getById(id: UUID): WorldCupTemplateDetailResponse {
        val e =
            worldCupTemplateRepository.findById(id).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "worldcup template not found")
        if (e.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }
        return e.toDetail()
    }

    @Transactional
    fun create(request: CreateWorldCupTemplateRequest, creatorId: Long): WorldCupTemplateCreatedResponse {
        val layout = normalizeLayoutMode(request.layoutMode)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "layoutMode 는 split_lr 또는 split_diagonal 이어야 합니다.")

        val itemsPayload = templateItemsPayloadToMap(request.items.items)

        val entity =
            WorldCupTemplate(
                title = request.title.trim(),
                description = request.description?.trim()?.takeIf { it.isNotEmpty() },
                itemsPayload = itemsPayload,
                creatorId = creatorId,
            )
        entity.layoutMode = layout
        entity.thumbnailUrl =
            normalizeThumbnailUrl(request.thumbnailUrl) ?: inferThumbnail(request.items.items)

        val saved = worldCupTemplateRepository.save(entity)
        worldCupTemplateRepository.flush()
        val tid = saved.id ?: throw IllegalStateException("worldcup template id missing after save")
        return WorldCupTemplateCreatedResponse(
            id = tid,
            title = saved.title,
            version = saved.version,
            creatorId = saved.creatorId,
            thumbnailUrl = normalizeThumbnailUrl(saved.thumbnailUrl),
        )
    }

    @Transactional
    fun patchMeta(
        id: UUID,
        request: UpdateWorldCupTemplateMetaRequest,
        userId: Long,
    ): PatchWorldCupTemplateMetaResponse {
        val entity =
            worldCupTemplateRepository.findById(id).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "worldcup template not found")
        if (entity.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제된 템플릿은 수정할 수 없습니다.")
        }
        val ownerId = entity.creatorId
        val isOwner = ownerId != null && ownerId == userId
        if (!isOwner) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not owner")
        }
        entity.applyMeta(request.title.trim(), request.description?.trim()?.takeIf { it.isNotEmpty() })
        worldCupTemplateRepository.flush()
        val tid = entity.id ?: throw IllegalStateException("worldcup template id missing")
        return PatchWorldCupTemplateMetaResponse(
            id = tid,
            title = entity.title,
            version = entity.version,
            description = entity.description?.trim()?.takeIf { it.isNotEmpty() },
        )
    }

    @Transactional
    fun delete(id: UUID, userId: Long, isAdmin: Boolean) {
        val entity =
            worldCupTemplateRepository.findById(id).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "worldcup template not found")
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

    private fun normalizeLayoutMode(raw: String): String? {
        val v = raw.trim().lowercase()
        return when (v) {
            "split_lr", "split_diagonal" -> v
            else -> null
        }
    }

    private fun templateItemsPayloadToMap(items: List<TemplateItemPayload>): Map<String, Any?> =
        mapOf(
            "items" to
                items.map { item ->
                    mapOf(
                        "id" to item.id.trim(),
                        "name" to item.name.trim(),
                        "imageUrl" to item.imageUrl?.trim()?.takeIf { it.isNotEmpty() },
                    )
                },
        )

    private fun inferThumbnail(items: List<TemplateItemPayload>): String? =
        items.firstNotNullOfOrNull { it.imageUrl?.trim()?.takeIf { u -> u.isNotEmpty() } }

    /** 목록·저장 후 응답과 동일 규칙으로 썸네일 URL 정규화 */
    private fun normalizeThumbnailUrl(raw: String?): String? =
        raw?.trim()?.takeIf { it.isNotEmpty() }

    private fun WorldCupTemplate.toSummary(): WorldCupTemplateSummaryResponse {
        val tid = id ?: throw IllegalStateException("worldcup template id missing")
        return WorldCupTemplateSummaryResponse(
            id = tid,
            title = title,
            version = version,
            description = description?.trim()?.takeIf { it.isNotEmpty() },
            thumbnailUrl = normalizeThumbnailUrl(thumbnailUrl),
            creatorId = creatorId,
            layoutMode = layoutMode,
            likeCount = likeCount,
            commentCount = commentCount,
            viewCount = viewCount,
        )
    }

    private fun WorldCupTemplate.toDetail(): WorldCupTemplateDetailResponse {
        val tid = id ?: throw IllegalStateException("worldcup template id missing")
        return WorldCupTemplateDetailResponse(
            id = tid,
            title = title,
            version = version,
            description = description?.trim()?.takeIf { it.isNotEmpty() },
            items = items,
            thumbnailUrl = normalizeThumbnailUrl(thumbnailUrl),
            creatorId = creatorId,
            layoutMode = layoutMode,
            likeCount = likeCount,
            commentCount = commentCount,
            viewCount = viewCount,
        )
    }
}
