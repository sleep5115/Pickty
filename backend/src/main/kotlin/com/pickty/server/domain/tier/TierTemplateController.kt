package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateDetailResponse
import com.pickty.server.domain.tier.dto.TemplateResponse
import com.pickty.server.domain.tier.dto.TemplateSummaryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/templates")
class TierTemplateController(
    private val tierTemplateService: TierTemplateService,
) {

    @GetMapping
    fun list(): List<TemplateSummaryResponse> =
        tierTemplateService.listSummaries()

    @GetMapping("/{id}")
    fun getById(@PathVariable id: UUID): TemplateDetailResponse =
        tierTemplateService.getById(id)

    @PostMapping
    fun create(
        @Valid @RequestBody body: CreateTemplateRequest,
        authentication: Authentication?,
    ): ResponseEntity<TemplateResponse> {
        val userId = resolveUserId(authentication)
        val created = tierTemplateService.create(body, userId)
        return ResponseEntity.status(HttpStatus.CREATED).body(created)
    }

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: UUID,
        @Valid @RequestBody body: CreateTemplateRequest,
        authentication: Authentication?,
    ): ResponseEntity<TemplateResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        val updated = tierTemplateService.update(id, body, userId)
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
