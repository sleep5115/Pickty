package com.pickty.server.domain.upload

import com.pickty.server.global.config.CloudflareR2Properties
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import org.springframework.web.server.ResponseStatusException
import software.amazon.awssdk.core.sync.RequestBody
import software.amazon.awssdk.core.sync.ResponseTransformer
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.GetObjectRequest
import software.amazon.awssdk.services.s3.model.PutObjectRequest
import software.amazon.awssdk.services.s3.model.S3Exception
import java.util.UUID

data class R2FetchedObject(
    val bytes: ByteArray,
    val contentType: String,
)

@Service
class R2ImageStorageService(
    private val s3Client: S3Client,
    private val props: CloudflareR2Properties,
) {

    private val log = LoggerFactory.getLogger(R2ImageStorageService::class.java)

    /** [storeOne] 과 동일 규칙: UUID 소문자 + 허용 확장자 */
    private val storedObjectKeyRegex =
        Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpe?g|webp|gif|bin)$")

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

    /**
     * 업로드 시 저장한 객체 키만 허용(UUID 파일명 + 확장자). 공개 URL이 403이어도 API가 R2에서 직접 읽어 제공.
     */
    fun fetchStoredObjectIfPresent(key: String): R2FetchedObject? {
        // 공개 URL 마지막 세그먼트에 대문자 UUID가 섞여도 저장 키는 항상 소문자
        val normalized = key.trim().lowercase()
        if (!isAllowedObjectKey(normalized)) {
            log.warn("R2 fetch skipped: key failed validation shape={}", normalized)
            return null
        }
        return try {
            val req = GetObjectRequest.builder()
                .bucket(props.bucketName)
                .key(normalized)
                .build()
            val resp = s3Client.getObject(req, ResponseTransformer.toBytes())
            val ct = resp.response().contentType()?.takeIf { it.isNotBlank() }
                ?: "application/octet-stream"
            R2FetchedObject(resp.asByteArray(), ct)
        } catch (_: software.amazon.awssdk.services.s3.model.NoSuchKeyException) {
            log.warn("R2 fetch miss: NoSuchKey bucket={} key={}", props.bucketName, normalized)
            null
        } catch (e: S3Exception) {
            if (e.statusCode() == 404) {
                log.warn("R2 fetch miss: S3 404 bucket={} key={} msg={}", props.bucketName, normalized, e.message)
                null
            } else {
                throw e
            }
        }
    }

    private fun isAllowedObjectKey(key: String): Boolean {
        if (key.length > 180 || key.contains('/') || key.contains('\\') || key.contains("..")) {
            return false
        }
        return storedObjectKeyRegex.matches(key)
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
