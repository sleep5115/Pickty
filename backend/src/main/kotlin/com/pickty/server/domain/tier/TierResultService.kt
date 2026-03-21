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
        val entity = TierResult(
            templateEntity = template,
            snapshotPayload = request.snapshotData,
            userIdInit = userId,
            isPublicInit = request.isPublic,
            isTemporaryInit = !loggedIn,
            listTitleInit = request.listTitle?.trim()?.takeIf { it.isNotEmpty() },
            listDescriptionInit = request.listDescription?.trim()?.takeIf { it.isNotEmpty() },
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
        )
    }
}
