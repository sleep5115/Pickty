package com.pickty.server.domain.upload

import com.pickty.server.domain.tier.resolveUserId
import com.pickty.server.domain.upload.dto.ImageUploadResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException

@RestController
@RequestMapping("/api/v1/images")
class ImageUploadController(
    private val r2ImageStorageService: R2ImageStorageService,
) {

    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        @RequestParam("files", required = false) files: List<MultipartFile>?,
        authentication: Authentication?,
    ): ResponseEntity<ImageUploadResponse> {
        resolveUserId(authentication)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "login required")
        val list = files?.filter { !it.isEmpty } ?: emptyList()
        if (list.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "no files")
        }
        val storedNames = r2ImageStorageService.storeAllOrdered(list)
        val urls = storedNames.map { r2ImageStorageService.publicUrlForStoredName(it) }
        return ResponseEntity.status(HttpStatus.CREATED).body(ImageUploadResponse(urls = urls))
    }
}
