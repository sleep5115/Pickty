package com.pickty.server.domain.ai.controller

import com.pickty.server.domain.ai.dto.AdminAutoGenerateRequest
import com.pickty.server.domain.ai.dto.AdminAutoGenerateResponse
import com.pickty.server.domain.ai.service.AiTemplateService
import jakarta.validation.Valid
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/admin/templates")
class AdminAiTemplateController(
    private val aiTemplateService: AiTemplateService,
) {

    @PostMapping("/auto-generate")
    @PreAuthorize("hasRole('ROLE_ADMIN')")
    fun autoGenerate(
        @Valid @RequestBody request: AdminAutoGenerateRequest
    ): AdminAutoGenerateResponse {
        return aiTemplateService.adminAutoGenerate(request)
    }
}
