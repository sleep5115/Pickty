package com.pickty.server.domain.upload.controller

import com.pickty.server.domain.upload.service.R2ImageStorageService
import com.pickty.server.global.security.resolveUserId
import com.pickty.server.domain.upload.dto.ImageUploadResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
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

    /**
     * `?key=` — 경로에 `.png` 등이 들어갈 때 프록시·서블릿 매핑 이슈를 피하기 위한 **권장** 엔드포인트.
     */
    @GetMapping("/file", params = ["key"])
    fun getStoredFileByQuery(@RequestParam("key") key: String): ResponseEntity<ByteArray> =
        serveStoredFile(key)

    /**
     * R2 공개 URL(img.pickty.app)이 403이어도, 서버가 버킷에서 직접 읽어 브라우저에 제공.
     * 게스트 허용(티어 템플릿 이미지). 키는 업로드 시 UUID 파일명 형식만 허용.
     */
    @GetMapping("/file/{key:.+}")
    fun getStoredFile(@PathVariable key: String): ResponseEntity<ByteArray> =
        serveStoredFile(key)

    private fun serveStoredFile(key: String): ResponseEntity<ByteArray> {
        val obj = r2ImageStorageService.fetchStoredObjectIfPresent(key)
            ?: return ResponseEntity.notFound().build()
        // 객체 키는 UUID 기반 불변 URL — 브라우저·중간 캐시(OG 크롤러·CDN)가 장기 재사용하도록 1년 + immutable
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(obj.contentType))
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000, immutable")
            .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(obj.bytes)
    }

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
