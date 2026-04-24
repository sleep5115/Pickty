package com.pickty.server.domain.admin.controller

import com.pickty.server.domain.ai.dto.AiAdminUsageResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateItemResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.service.AiApiUsageService
import com.pickty.server.domain.ai.service.AiGenerationService
import jakarta.validation.Valid
import org.springframework.security.access.prepost.PreAuthorize
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/admin/ai")
class AdminAiGenerationController(
    private val aiGenerationService: AiGenerationService,
    private val aiApiUsageService: AiApiUsageService,
) {

    @GetMapping("/usage")
    @PreAuthorize("hasRole('ADMIN')")
    fun usage(): AiAdminUsageResponse = aiApiUsageService.getTodayUsagePt()

    @PostMapping("/auto-generate")
    @PreAuthorize("hasRole('ADMIN')")
    fun autoGenerate(
        @Valid @RequestBody request: AiAutoGenerateRequest,
    ): List<AiAutoGenerateItemResponse> = aiGenerationService.autoGenerate(request)
}
