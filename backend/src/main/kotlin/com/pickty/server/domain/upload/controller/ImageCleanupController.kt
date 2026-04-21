package com.pickty.server.domain.upload.controller

import com.pickty.server.domain.upload.service.ImageCleanupReport
import com.pickty.server.domain.upload.service.ImageCleanupService
import com.pickty.server.global.security.isAdmin
import com.pickty.server.global.security.resolveUserIdOrThrow
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException

/**
 * R2(Cloudflare) 고아 이미지 점검·정리용 **관리자 전용** API.
 * 로컬: ADMIN 역할 JWT 로 `POST` 호출.
 */
@RestController
@RequestMapping("/api/v1/admin/image-cleanup")
class ImageCleanupController(
    private val imageCleanupService: ImageCleanupService,
) {

    @PostMapping("/run")
    fun run(
        authentication: Authentication?,
        @RequestParam(defaultValue = "true") dryRun: Boolean,
        @RequestParam(defaultValue = "false") executeDelete: Boolean,
        @RequestParam(required = false) extensions: String?,
    ): ImageCleanupReport {
        resolveUserIdOrThrow(authentication)
        if (!isAdmin(authentication)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "admin only")
        }
        val extSet = extensions
            ?.split(',')
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.toSet()
            ?.takeIf { it.isNotEmpty() }
        return imageCleanupService.runCleanup(
            dryRun = dryRun,
            executeDelete = executeDelete,
            extensionFilter = extSet,
        )
    }
}
