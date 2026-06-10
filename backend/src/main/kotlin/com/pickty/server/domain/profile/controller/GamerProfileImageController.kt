package com.pickty.server.domain.profile.controller

import com.pickty.server.domain.profile.service.GamerProfileRateLimiter
import com.pickty.server.domain.upload.dto.ImageUploadResponse
import com.pickty.server.domain.upload.service.R2ImageStorageService
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

/**
 * 프로필 전용 이미지 업로드 — 아바타·인증샷·현실피드.
 *
 * 겜생프로필은 비회원 우선이라 로그인 잠금인 `/api/v1/images` 대신 **비회원도 허용하는** 별도 경로를 둔다.
 * 어뷰징은 IP 시간당 업로드 횟수 제한([GamerProfileRateLimiter])으로 가드한다.
 * 압축·매직검증·R2 저장은 기존 [R2ImageStorageService] 를 그대로 재사용한다.
 */
@RestController
@RequestMapping("/api/v1/profile/images")
class GamerProfileImageController(
    private val r2ImageStorageService: R2ImageStorageService,
    private val rateLimiter: GamerProfileRateLimiter,
) {

    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        @RequestParam("files", required = false) files: List<MultipartFile>?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<ImageUploadResponse> {
        val clientIp = ClientIpResolver.resolve(httpRequest)
        val ipHash = if (clientIp == "unknown") "unknown" else Sha256Hex.hash(clientIp)
        rateLimiter.checkImageUpload(ipHash)

        val list = files?.filter { !it.isEmpty } ?: emptyList()
        if (list.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "no files")
        }
        val storedNames = r2ImageStorageService.storeAllOrdered(list)
        val urls = storedNames.map { r2ImageStorageService.publicUrlForStoredName(it) }
        return ResponseEntity.status(HttpStatus.CREATED).body(ImageUploadResponse(urls = urls))
    }
}
