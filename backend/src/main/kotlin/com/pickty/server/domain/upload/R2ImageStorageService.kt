package com.pickty.server.domain.upload

import com.pickty.server.global.config.CloudflareR2Properties
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import java.util.UUID

@Service
class R2ImageStorageService(
    private val s3Client: S3Client,
    private val props: CloudflareR2Properties,
) {

    fun storeAllOrdered(files: List<MultipartFile>): List<String> {
        if (files.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "no files")
        }
        return files.map { storeOne(it) }
    }

    fun publicUrlForStoredName(storedName: String): String {
        val base = props.publicUrl.trimEnd('/')
        return "$base/$storedName"
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
        val put = PutObjectRequest.builder()
            .bucket(props.bucketName)
            .key(storedName)
            .contentType(ct.ifBlank { "application/octet-stream" })
            .build()
        val bytes = file.inputStream.use { it.readAllBytes() }
        if (bytes.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "empty file")
        }
        s3Client.putObject(put, RequestBody.fromBytes(bytes))
        return storedName
    }

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
