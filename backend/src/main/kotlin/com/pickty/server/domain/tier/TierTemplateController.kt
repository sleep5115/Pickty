package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTemplateRequest
import com.pickty.server.domain.tier.dto.TemplateDetailResponse
import com.pickty.server.domain.tier.dto.TemplateResponse
import com.pickty.server.domain.tier.dto.TemplateSummaryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
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
}
