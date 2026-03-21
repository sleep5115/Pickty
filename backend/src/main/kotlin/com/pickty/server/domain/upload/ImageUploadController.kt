package com.pickty.server.domain.upload

import com.pickty.server.domain.tier.resolveUserId
import com.pickty.server.domain.upload.dto.ImageUploadResponse
import jakarta.servlet.http.HttpServletRequest
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
    private val localDesktopImageStorageService: LocalDesktopImageStorageService,
) {

    @PostMapping(consumes = [MediaType.MULTIPART_FORM_DATA_VALUE])
    fun upload(
        request: HttpServletRequest,
        @RequestParam("files", required = false) files: List<MultipartFile>?,
        authentication: Authentication?,
    ): ResponseEntity<ImageUploadResponse> {
        resolveUserId(authentication)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "login required")
        val list = files?.filter { !it.isEmpty } ?: emptyList()
        if (list.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "no files")
        }
        val storedNames = localDesktopImageStorageService.storeAllOrdered(list)
        val base = requestBaseUrl(request)
        val urls = storedNames.map { name -> "$base/uploads/$name" }
        return ResponseEntity.status(HttpStatus.CREATED).body(ImageUploadResponse(urls = urls))
    }

    private fun requestBaseUrl(request: HttpServletRequest): String {
        val scheme = request.scheme
        val host = request.serverName
        val port = request.serverPort
        val defaultPort = (scheme == "https" && port == 443) || (scheme == "http" && port == 80)
        val portPart = if (defaultPort) "" else ":$port"
        return "$scheme://$host$portPart"
    }
}
