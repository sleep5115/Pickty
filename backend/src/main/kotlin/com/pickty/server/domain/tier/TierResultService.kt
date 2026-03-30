package com.pickty.server.domain.tier

import com.fasterxml.jackson.databind.JsonNode
import com.pickty.server.domain.tier.dto.CreateTierResultRequest
import com.pickty.server.domain.tier.dto.TierResultResponse
import com.pickty.server.domain.tier.dto.TierResultSummaryResponse
import com.pickty.server.domain.tier.dto.UpdateTierResultMetaRequest
import com.pickty.server.global.exception.PicktyValidationException
import jakarta.validation.Validator
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.time.format.DateTimeFormatter
import java.util.UUID

@Service
class TierResultService(
    private val tierResultRepository: TierResultRepository,
    private val tierTemplateRepository: TierTemplateRepository,
    private val tierResultCacheService: TierResultCacheService,
    private val validator: Validator,
) {

    @Transactional
    fun create(request: CreateTierResultRequest, userId: Long?): TierResultResponse {
        val template = tierTemplateRepository.findById(request.templateId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }
        if (template.templateStatus == TemplateStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.GONE, "template was removed")
        }

        val loggedIn = userId != null
        val thumb = request.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
        val entity = TierResult(
            templateEntity = template,
            snapshotPayload = request.snapshotData,
            userIdInit = userId,
            isPublicInit = request.isPublic,
            isTemporaryInit = !loggedIn,
            listTitleInit = request.listTitle?.trim()?.takeIf { it.isNotEmpty() },
            listDescriptionInit = request.listDescription?.trim()?.takeIf { it.isNotEmpty() },
            thumbnailUrlInit = thumb,
        )
        val saved = tierResultRepository.save(entity)
        val id = saved.id ?: throw IllegalStateException("result id missing after save")
        tierResultCacheService.evict(id)
        return toResponse(saved)
    }

    @Transactional(readOnly = true)
    fun listMine(userId: Long): List<TierResultSummaryResponse> =
        tierResultRepository
            .findByUserIdAndResultStatusWithTemplateOrderByCreatedAtDesc(userId, ResultStatus.ACTIVE)
            .map { toSummaryResponse(it) }

    @Transactional(readOnly = true)
    fun listAll(pageable: Pageable): Page<TierResultSummaryResponse> =
        tierResultRepository.findAllByResultStatusOrderByCreatedAtDesc(ResultStatus.ACTIVE, pageable)
            .map { toSummaryResponse(it) }

    private fun toSummaryResponse(e: TierResult): TierResultSummaryResponse {
        val fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME
        val rid = e.id ?: throw IllegalStateException("result id null")
        val tpl = e.template
        val tid = tpl.id ?: throw IllegalStateException("template id null")
        return TierResultSummaryResponse(
            id = rid,
            templateId = tid,
            templateTitle = tpl.title,
            templateVersion = tpl.version,
            listTitle = e.listTitle,
            listDescription = e.listDescription,
            isPublic = e.isPublic,
            resultStatus = e.resultStatus,
            userId = e.userId,
            createdAt = e.createdAt.format(fmt),
            thumbnailUrl = e.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
                ?: firstHttpImageFromSnapshot(e.snapshotData),
            upCount = e.upCount,
            downCount = e.downCount,
            commentCount = e.commentCount,
        )
    }

    @Transactional(readOnly = true)
    fun getById(id: UUID): TierResultResponse {
        tierResultCacheService.getCached(id)?.let { return it }
        val entity = tierResultRepository.findByIdWithTemplate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "tier result not found")
        val dto = toResponse(entity)
        tierResultCacheService.put(id, dto)
        return dto
    }

    @Transactional
    fun patchMetadata(id: UUID, userId: Long, body: JsonNode): TierResultResponse {
        assertPatchMetaKeysAllowed(body)
        validatePatchMetaLengths(body)

        val entity = tierResultRepository.findByIdWithTemplate(id)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "tier result not found")
        if (entity.resultStatus == ResultStatus.DELETED) {
            throw PicktyValidationException(listOf("삭제된 티어표는 수정할 수 없습니다."))
        }
        if (entity.userId != userId) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not owner")
        }
        var title = entity.listTitle
        var description = entity.listDescription
        if (body.has("title")) {
            val n = body.get("title")
            title = if (n.isNull) null else n.asText()?.trim()?.takeIf { it.isNotEmpty() }
        }
        if (body.has("description")) {
            val n = body.get("description")
            description = if (n.isNull) null else n.asText()?.trim()?.takeIf { it.isNotEmpty() }
        }
        entity.applyListMeta(title, description)
        val rid = entity.id ?: throw IllegalStateException("result id null")
        tierResultCacheService.evict(rid)
        return toResponse(entity)
    }

    private fun assertPatchMetaKeysAllowed(body: JsonNode) {
        val allowed = setOf("title", "description")
        val it = body.fieldNames()
        while (it.hasNext()) {
            val key = it.next()
            if (key !in allowed) {
                throw PicktyValidationException(listOf("허용되지 않은 필드입니다: $key"))
            }
        }
    }

    private fun validatePatchMetaLengths(body: JsonNode) {
        val messages = mutableListOf<String>()
        if (body.has("title")) {
            val v = if (body.get("title").isNull) null else body.get("title").asText()
            val probe = UpdateTierResultMetaRequest(title = v, description = null)
            validator.validateProperty(probe, "title").forEach { messages.add(it.message) }
        }
        if (body.has("description")) {
            val v = if (body.get("description").isNull) null else body.get("description").asText()
            val probe = UpdateTierResultMetaRequest(title = null, description = v)
            validator.validateProperty(probe, "description").forEach { messages.add(it.message) }
        }
        if (messages.isNotEmpty()) {
            throw PicktyValidationException(messages.distinct())
        }
    }

    @Transactional
    fun delete(id: UUID, userId: Long, isAdmin: Boolean) {
        val entity = tierResultRepository.findById(id)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "tier result not found") }
        val ownerId = entity.userId
        val allowed = isAdmin || (ownerId != null && ownerId == userId)
        if (!allowed) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "not allowed")
        }
        val rid = entity.id ?: throw IllegalStateException("result id null")
        if (entity.resultStatus == ResultStatus.DELETED) {
            tierResultCacheService.evict(rid)
            return
        }
        entity.markDeleted()
        tierResultCacheService.evict(rid)
    }

    private fun toResponse(entity: TierResult): TierResultResponse {
        val tid = entity.id ?: throw IllegalStateException("result id null")
        val tpl = entity.template
        val tplId = tpl.id ?: throw IllegalStateException("template id null")
        return TierResultResponse(
            id = tid,
            templateId = tplId,
            templateTitle = tpl.title,
            templateVersion = tpl.version,
            listTitle = entity.listTitle,
            listDescription = entity.listDescription,
            snapshotData = entity.snapshotData,
            isPublic = entity.isPublic,
            isTemporary = entity.isTemporary,
            resultStatus = entity.resultStatus,
            userId = entity.userId,
            thumbnailUrl = entity.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
                ?: firstHttpImageFromSnapshot(entity.snapshotData),
            upCount = entity.upCount,
            downCount = entity.downCount,
            commentCount = entity.commentCount,
        )
    }

    /** PNG 미리보기 URL 없을 때 목록, 상세 카드용 — 스냅샷 풀/티어 아이템 첫 http(s) 이미지 */
    @Suppress("UNCHECKED_CAST")
    private fun firstHttpImageFromSnapshot(snapshot: Map<String, Any?>): String? {
        val pool = snapshot["pool"]
        if (pool is List<*>) {
            for (entry in pool) {
                httpUrlFromSnapshotItem(entry)?.let { return it }
            }
        }
        val tiers = snapshot["tiers"]
        if (tiers is List<*>) {
            for (tier in tiers) {
                if (tier !is Map<*, *>) continue
                val t = tier as Map<String, Any?>
                val items = t["items"] ?: continue
                if (items !is List<*>) continue
                for (item in items) {
                    httpUrlFromSnapshotItem(item)?.let { return it }
                }
            }
        }
        return null
    }

    @Suppress("UNCHECKED_CAST")
    private fun httpUrlFromSnapshotItem(entry: Any?): String? {
        if (entry !is Map<*, *>) return null
        val map = entry as Map<String, Any?>
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
