package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTierResultRequest
import com.pickty.server.domain.tier.dto.TierResultResponse
import com.pickty.server.domain.tier.dto.TierResultSummaryResponse
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
) {

    @Transactional
    fun create(request: CreateTierResultRequest, userId: Long?): TierResultResponse {
        val template = tierTemplateRepository.findById(request.templateId)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "template not found") }

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
    fun listMine(userId: Long): List<TierResultSummaryResponse> {
        val fmt = DateTimeFormatter.ISO_LOCAL_DATE_TIME
        return tierResultRepository.findByUserIdWithTemplateOrderByCreatedAtDesc(userId).map { e ->
            val rid = e.id ?: throw IllegalStateException("result id null")
            val tpl = e.template
            val tid = tpl.id ?: throw IllegalStateException("template id null")
            TierResultSummaryResponse(
                id = rid,
                templateId = tid,
                templateTitle = tpl.title,
                templateVersion = tpl.version,
                listTitle = e.listTitle,
                listDescription = e.listDescription,
                isPublic = e.isPublic,
                createdAt = e.createdAt.format(fmt),
                thumbnailUrl = e.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
                    ?: firstHttpImageFromSnapshot(e.snapshotData),
            )
        }
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
            userId = entity.userId,
            thumbnailUrl = entity.thumbnailUrl?.trim()?.takeIf { it.isNotEmpty() }
                ?: firstHttpImageFromSnapshot(entity.snapshotData),
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
