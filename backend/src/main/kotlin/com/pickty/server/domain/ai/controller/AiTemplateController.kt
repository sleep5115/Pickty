package com.pickty.server.domain.ai.controller

import com.pickty.server.domain.ai.dto.AiTemplateItemGenerateRequest
import com.pickty.server.domain.ai.dto.AiTemplateItemResponse
import com.pickty.server.domain.ai.service.AiTemplateService
import com.pickty.server.global.security.resolveUserIdOrThrow
import jakarta.validation.Valid
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/ai")
class AiTemplateController(
    private val aiTemplateService: AiTemplateService,
) {

    @PostMapping("/generate-items")
    fun generateItems(
        @Valid @RequestBody request: AiTemplateItemGenerateRequest,
        authentication: Authentication?,
    ): List<AiTemplateItemResponse> {
        resolveUserIdOrThrow(authentication)
        return aiTemplateService.generateItems(request)
    }
}
