package com.pickty.server.domain.worldcup.controller

import com.pickty.server.domain.worldcup.dto.CreateWorldCupTemplateRequest
import com.pickty.server.domain.worldcup.dto.PatchWorldCupTemplateMetaResponse
import com.pickty.server.domain.worldcup.dto.UpdateWorldCupTemplateMetaRequest
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateCreatedResponse
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateDetailResponse
import com.pickty.server.domain.worldcup.dto.WorldCupTemplateSummaryResponse
import com.pickty.server.domain.worldcup.service.WorldCupTemplateService
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
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/worldcup/templates")
class WorldCupTemplateController(
    private val worldCupTemplateService: WorldCupTemplateService,
) {

    @GetMapping
    fun list(authentication: Authentication?): List<WorldCupTemplateSummaryResponse> =
        worldCupTemplateService.listSummaries(resolveUserId(authentication))

    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): WorldCupTemplateDetailResponse =
        worldCupTemplateService.getById(id)

    @PostMapping
    fun create(
        @Valid @RequestBody body: CreateWorldCupTemplateRequest,
        authentication: Authentication?,
    ): ResponseEntity<WorldCupTemplateCreatedResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val created = worldCupTemplateService.create(body, userId)
        return ResponseEntity.status(HttpStatus.CREATED).body(created)
    }

    @PatchMapping("/{id}")
    fun patchMeta(
        @PathVariable id: UUID,
        @Valid @RequestBody body: UpdateWorldCupTemplateMetaRequest,
        authentication: Authentication?,
    ): ResponseEntity<PatchWorldCupTemplateMetaResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val updated = worldCupTemplateService.patchMeta(id, body, userId, isAdmin(authentication))
        return ResponseEntity.ok(updated)
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: UUID,
        authentication: Authentication?,
    ): ResponseEntity<Void> {
        val userId = resolveUserIdOrThrow(authentication)
        worldCupTemplateService.delete(id, userId, isAdmin(authentication))
        return ResponseEntity.noContent().build()
    }
}
