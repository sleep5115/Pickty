package com.pickty.server.domain.worldcup.service

import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.interaction.service.MyReactionService
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
import java.util.HashMap
import java.util.UUID

@Service
class WorldCupTemplateService(
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    private val myReactionService: MyReactionService,
) {

    fun listSummaries(viewerUserId: Long?): List<WorldCupTemplateSummaryResponse> {
        val rows =
            worldCupTemplateRepository.findAllByTemplateStatusOrderByCreatedAtDesc(TemplateStatus.ACTIVE)
        val ids = rows.mapNotNull { it.id }
        val reactions =
            myReactionService.mapByTargetIds(ReactionTargetType.WORLDCUP_TEMPLATE, ids, viewerUserId)
        return rows.map { e ->
            val id = e.id ?: throw IllegalStateException("worldcup template id missing")
            WorldCupTemplateSummaryResponse(
                id = id,
                title = e.title,
                version = e.version,
                description = e.description?.trim()?.takeIf { it.isNotEmpty() },
                thumbnailUrl = normalizeThumbnailUrl(e.thumbnailUrl),
                creatorId = e.creatorId,
                layoutMode = e.layoutMode,
                itemCount = e.items.size,
                likeCount = e.likeCount,
                commentCount = e.commentCount,
                viewCount = e.viewCount,
                myReaction = reactions[id],
            )
        }
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

        val itemsPayload = templateItemsPayloadToRows(request.items)

        val entity =
            WorldCupTemplate(
                title = request.title.trim(),
                description = request.description?.trim()?.takeIf { it.isNotEmpty() },
                itemsPayload = itemsPayload,
                creatorId = creatorId,
            )
        entity.layoutMode = layout
        entity.thumbnailUrl =
            normalizeThumbnailUrl(request.thumbnailUrl) ?: inferThumbnail(request.items)

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
        isAdmin: Boolean,
    ): PatchWorldCupTemplateMetaResponse {
        val entity =
            worldCupTemplateRepository.findById(id).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "worldcup template not found")
        if (entity.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제된 템플릿은 수정할 수 없습니다.")
        }
        val ownerId = entity.creatorId
        val allowed = isAdmin || (ownerId != null && ownerId == userId)
        if (!allowed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not owner")
        }
        val layoutPatch =
            request.layoutMode?.trim()?.takeIf { it.isNotEmpty() }?.let {
                normalizeLayoutMode(it)
                    ?: throw ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "layoutMode 는 split_lr 또는 split_diagonal 이어야 합니다.",
                    )
            }
        entity.applyMeta(
            request.title.trim(),
            request.description?.trim()?.takeIf { it.isNotEmpty() },
            layoutPatch,
        )
        worldCupTemplateRepository.flush()
        val tid = entity.id ?: throw IllegalStateException("worldcup template id missing")
        return PatchWorldCupTemplateMetaResponse(
            id = tid,
            title = entity.title,
            version = entity.version,
            description = entity.description?.trim()?.takeIf { it.isNotEmpty() },
            layoutMode = entity.layoutMode,
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

    private fun templateItemsPayloadToRows(items: List<TemplateItemPayload>): List<Map<String, Any?>> =
        items.map { item ->
            buildMap<String, Any?> {
                put("id", item.id)
                put("name", item.name.trim())
                item.imageUrl?.trim()?.takeIf { it.isNotEmpty() }?.let { put("imageUrl", it) }
            }
        }

    private fun inferThumbnail(items: List<TemplateItemPayload>): String? =
        items.firstNotNullOfOrNull { it.imageUrl?.trim()?.takeIf { u -> u.isNotEmpty() } }

    private fun normalizeThumbnailUrl(raw: String?): String? =
        raw?.trim()?.takeIf { it.isNotEmpty() }

    private fun WorldCupTemplate.toDetail(): WorldCupTemplateDetailResponse {
        val tid = id ?: throw IllegalStateException("worldcup template id missing")
        return WorldCupTemplateDetailResponse(
            id = tid,
            title = title,
            version = version,
            description = description?.trim()?.takeIf { it.isNotEmpty() },
            items = items.map { HashMap(it) },
            thumbnailUrl = normalizeThumbnailUrl(thumbnailUrl),
            creatorId = creatorId,
            layoutMode = layoutMode,
            likeCount = likeCount,
            commentCount = commentCount,
            viewCount = viewCount,
        )
    }
}
