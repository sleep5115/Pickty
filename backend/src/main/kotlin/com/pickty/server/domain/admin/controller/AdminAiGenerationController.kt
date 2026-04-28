package com.pickty.server.domain.admin.controller

import com.pickty.server.domain.ai.dto.AiAdminUsageResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateItemResponse
import com.pickty.server.domain.ai.dto.AiAutoGenerateRequest
import com.pickty.server.domain.ai.service.AiApiUsageService
import com.pickty.server.domain.ai.service.AiGenerationService
import com.pickty.server.domain.auth.service.DemoAccountPolicy
import com.pickty.server.global.security.isAdmin
import com.pickty.server.global.security.resolveUserIdOrThrow
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.server.ResponseStatusException
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
    private val demoAccountPolicy: DemoAccountPolicy,
) {

    @GetMapping("/usage")
    fun usage(authentication: Authentication?): AiAdminUsageResponse {
        val userId = resolveUserIdOrThrow(authentication)
        if (!isAdmin(authentication) && !demoAccountPolicy.canUseAiDemo(userId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "admin or demo account required")
        }
        return aiApiUsageService.getTodayUsagePt()
    }

    @PostMapping("/auto-generate")
    fun autoGenerate(
        @Valid @RequestBody request: AiAutoGenerateRequest,
        authentication: Authentication?,
    ): List<AiAutoGenerateItemResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        if (!isAdmin(authentication) && !demoAccountPolicy.canUseAiDemo(userId)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "admin or demo account required")
        }
        return aiGenerationService.autoGenerate(request)
    }
}
