package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.PatchTemplateMetaResponse
import com.pickty.server.domain.tier.dto.TemplateDetailResponse
import com.pickty.server.domain.tier.dto.TemplateResponse
import com.pickty.server.domain.tier.dto.TemplateSummaryResponse
import com.pickty.server.domain.tier.dto.UpdateTemplateMetaRequest
import com.pickty.server.global.security.isAdmin
import com.pickty.server.global.security.resolveUserId
import com.pickty.server.global.security.resolveUserIdOrThrow
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/templates")
class TierTemplateController(
    private val tierTemplateService: TierTemplateService,
) {

    @GetMapping
    fun list(authentication: Authentication?): List<TemplateSummaryResponse> =
        tierTemplateService.listSummaries(resolveUserId(authentication))

    @GetMapping("/mine")
    fun listMine(authentication: Authentication?): List<TemplateSummaryResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        return tierTemplateService.listMySummaries(userId, userId)
    }

    @GetMapping("/{id}")
    fun getById(
        @PathVariable id: UUID,
        @RequestParam(name = "countView", defaultValue = "true") countView: Boolean,
        authentication: Authentication?,
    ): TemplateDetailResponse =
        tierTemplateService.getById(id, resolveUserId(authentication), countView)

    @PostMapping
    fun create(
        @Valid @RequestBody body: CreateTemplateRequest,
        authentication: Authentication?,
    ): ResponseEntity<TemplateResponse> {
        val userId = resolveUserId(authentication)
        val created = tierTemplateService.create(body, userId)
        return ResponseEntity.status(HttpStatus.CREATED).body(created)
    }

    @PatchMapping("/{id}")
    fun patchMeta(
        @PathVariable id: UUID,
        @Valid @RequestBody body: UpdateTemplateMetaRequest,
        authentication: Authentication?,
    ): ResponseEntity<PatchTemplateMetaResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val updated = tierTemplateService.patchTemplateMeta(id, body, userId, isAdmin(authentication))
        return ResponseEntity.ok(updated)
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: UUID,
        authentication: Authentication?,
    ): ResponseEntity<Void> {
        val userId = resolveUserIdOrThrow(authentication)
        val admin = isAdmin(authentication)
        tierTemplateService.delete(id, userId, admin)
        return ResponseEntity.noContent().build()
    }
}
