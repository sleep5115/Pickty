package com.pickty.server.domain.upload.service

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
import software.amazon.awssdk.services.s3.model.NoSuchKeyException
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
    private val storedObjectKeyRegex = STORED_OBJECT_KEY_REGEX

    companion object {
        /** 업로드 객체 키 형식 — 고아 정리·DB 스캔 등에서 동일 규칙으로 맞춘다 */
        val STORED_OBJECT_KEY_REGEX: Regex =
            Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpe?g|webp|gif|bin)$")

        /** JSON·본문 안에 포함된 키 후보를 찾을 때(앵커 없음) */
        val STORED_OBJECT_KEY_FRAGMENT_REGEX: Regex =
            Regex(
                "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(?:png|jpe?g|webp|gif|bin)",
                RegexOption.IGNORE_CASE,
            )
    }

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
        } catch (_: NoSuchKeyException) {
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
        val rawCt = file.contentType?.trim().orEmpty()
        if (rawCt.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "content type required")
        }
        val canonical = normalizeToAllowedImageContentType(rawCt)
            ?: throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "unsupported image content type; allowed: image/jpeg, image/png, image/webp, image/gif",
            )
        val bytes = file.inputStream.use { it.readAllBytes() }
        if (bytes.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "empty file")
        }
        if (!magicBytesMatchImageContentType(bytes, canonical)) {
            throw ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "file content does not match declared image type",
            )
        }
        val ext = fileExtensionForCanonicalType(canonical)
        val storedName = "${UUID.randomUUID()}$ext"
        val put = PutObjectRequest.builder()
            .bucket(props.bucketName)
            .key(storedName)
            .contentType(canonical)
            .build()
        s3Client.putObject(put, RequestBody.fromBytes(bytes))
        return storedName
    }

    /**
     * `image/svg+xml` 등 `image/` 접두사만으로 전부 허용하면 XSS 등으로 이어질 수 있어 **화이트리스트**만 허용.
     * 선언된 MIME 과 실제 **매직 넘버**가 맞는지 검사해 확장자·MIME 위조(.exe 등)를 막는다.
     */
    private fun normalizeToAllowedImageContentType(raw: String): String? {
        val base = raw.substringBefore(';').trim().lowercase()
        return when (base) {
            "image/jpeg", "image/jpg", "image/pjpeg" -> "image/jpeg"
            "image/png", "image/x-png" -> "image/png"
            "image/webp" -> "image/webp"
            "image/gif" -> "image/gif"
            else -> null
        }
    }

    private fun magicBytesMatchImageContentType(bytes: ByteArray, canonical: String): Boolean =
        when (canonical) {
            "image/jpeg" ->
                bytes.size >= 3 &&
                    bytes[0] == 0xFF.toByte() &&
                    bytes[1] == 0xD8.toByte() &&
                    bytes[2] == 0xFF.toByte()
            "image/png" ->
                bytes.size >= 8 &&
                    bytes[0] == 0x89.toByte() &&
                    bytes[1] == 0x50.toByte() &&
                    bytes[2] == 0x4E.toByte() &&
                    bytes[3] == 0x47.toByte() &&
                    bytes[4] == 0x0D.toByte() &&
                    bytes[5] == 0x0A.toByte() &&
                    bytes[6] == 0x1A.toByte() &&
                    bytes[7] == 0x0A.toByte()
            "image/gif" ->
                bytes.size >= 6 &&
                    bytes[0] == 'G'.code.toByte() &&
                    bytes[1] == 'I'.code.toByte() &&
                    bytes[2] == 'F'.code.toByte() &&
                    bytes[3] == '8'.code.toByte() &&
                    (bytes[4] == '7'.code.toByte() || bytes[4] == '9'.code.toByte()) &&
                    bytes[5] == 'a'.code.toByte()
            "image/webp" ->
                bytes.size >= 12 &&
                    bytes[0] == 'R'.code.toByte() &&
                    bytes[1] == 'I'.code.toByte() &&
                    bytes[2] == 'F'.code.toByte() &&
                    bytes[3] == 'F'.code.toByte() &&
                    bytes[8] == 'W'.code.toByte() &&
                    bytes[9] == 'E'.code.toByte() &&
                    bytes[10] == 'B'.code.toByte() &&
                    bytes[11] == 'P'.code.toByte()
            else -> false
        }

    private fun fileExtensionForCanonicalType(canonical: String): String =
        when (canonical) {
            "image/jpeg" -> ".jpg"
            "image/png" -> ".png"
            "image/webp" -> ".webp"
            "image/gif" -> ".gif"
            else -> ".bin"
        }
}
