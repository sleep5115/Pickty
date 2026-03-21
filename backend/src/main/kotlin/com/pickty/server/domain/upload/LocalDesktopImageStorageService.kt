package com.pickty.server.domain.upload

import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.nio.file.StandardCopyOption
import java.util.UUID

/**
 * 개발용: 호스트 PC 바탕화면 `pickty_uploads`에 이미지 저장.
 * 운영·R2 전환 시 이 서비스 구현체만 교체하면 됨.
 */
@Service
class LocalDesktopImageStorageService {

    private val uploadRoot: Path =
        Paths.get(System.getProperty("user.home"), "Desktop", "pickty_uploads").toAbsolutePath().normalize()

    init {
        Files.createDirectories(uploadRoot)
    }

    fun storeAllOrdered(files: List<MultipartFile>): List<String> {
        if (files.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "no files")
        }
        return files.map { storeOne(it) }
    }

    private fun storeOne(file: MultipartFile): String {
        if (file.isEmpty) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "empty file")
        }
        val ct = file.contentType ?: ""
        if (!ct.startsWith("image/")) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "only image/* is allowed")
        }
        val ext = extensionFromOriginal(file.originalFilename)
            ?: extensionFromContentType(ct)
            ?: ".bin"
        val storedName = "${UUID.randomUUID()}$ext"
        val target = uploadRoot.resolve(storedName).normalize()
        if (!target.startsWith(uploadRoot)) {
            throw ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "invalid path")
        }
        file.inputStream.use { input ->
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING)
        }
        return storedName
    }

    fun rootPath(): Path = uploadRoot

    private fun extensionFromOriginal(name: String?): String? {
        if (name.isNullOrBlank()) return null
        val dot = name.lastIndexOf('.')
        if (dot < 0 || dot == name.length - 1) return null
        val ext = name.substring(dot).lowercase()
        return if (ext.length in 2..12 && ext.all { it.isLetterOrDigit() || it == '.' }) ext else null
    }

    private fun extensionFromContentType(ct: String): String? = when {
        ct.contains("png", ignoreCase = true) -> ".png"
        ct.contains("jpeg", ignoreCase = true) || ct.contains("jpg", ignoreCase = true) -> ".jpg"
        ct.contains("webp", ignoreCase = true) -> ".webp"
        ct.contains("gif", ignoreCase = true) -> ".gif"
        else -> null
    }
}
