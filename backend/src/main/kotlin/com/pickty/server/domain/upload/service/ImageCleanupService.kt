package com.pickty.server.domain.upload

import com.pickty.server.global.config.CloudflareR2Properties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request
import software.amazon.awssdk.services.s3.model.S3Object

data class ImageCleanupReport(
    val dryRun: Boolean,
    val executeDeleteRequested: Boolean,
    val executeDeleteAllowedByConfig: Boolean,
    val extensionFilter: List<String>,
    val r2ObjectCount: Int,
    val dbReferencedKeyCount: Int,
    val orphanCount: Int,
    val orphanTotalBytes: Long,
    /** 샘플(로그·응답 공용 상한) */
    val orphanKeysSample: List<String>,
    val deletedCount: Int,
    val message: String?,
)

@Service
class ImageCleanupService(
    private val s3Client: S3Client,
    private val props: CloudflareR2Properties,
    private val referencedKeysReader: ImageReferencedKeysReader,
    @Value("\${pickty.image-cleanup.allow-execute-delete:false}")
    private val allowExecuteDeleteFromConfig: Boolean,
) {

    private val log = LoggerFactory.getLogger(ImageCleanupService::class.java)

    fun runCleanup(
        dryRun: Boolean = true,
        executeDelete: Boolean = false,
        extensionFilter: Set<String>? = null,
    ): ImageCleanupReport = runBlocking { runCleanupSuspend(dryRun, executeDelete, extensionFilter) }

    private suspend fun runCleanupSuspend(
        dryRun: Boolean,
        executeDelete: Boolean,
        extensionFilter: Set<String>?,
    ): ImageCleanupReport = coroutineScope {
        val r2Deferred = async(Dispatchers.IO) { listAllR2Objects() }
        val dbDeferred = async(Dispatchers.IO) { referencedKeysReader.loadAllReferencedKeys() }
        val r2Objects = r2Deferred.await()
        val dbKeys = dbDeferred.await()

        val extSet = extensionFilter
            ?.map { it.trim().lowercase().removePrefix(".") }
            ?.filter { it.isNotEmpty() }
            ?.toSet()
            ?.takeIf { it.isNotEmpty() }

        fun passesExt(key: String): Boolean {
            if (extSet == null) return true
            val ext = key.substringAfterLast('.', "").lowercase()
            return ext in extSet
        }

        val r2KeysInScope = r2Objects.filter { (key, _) -> passesExt(key) }
        val orphans = r2KeysInScope.filter { (key, _) -> key.lowercase() !in dbKeys }
        val orphanTotalBytes = orphans.sumOf { it.second }
        val orphanKeys = orphans.map { it.first }

        val sampleLimit = 150
        val sample = orphanKeys.take(sampleLimit)
        val sizeByKey = orphans.associate { it.first to it.second }

        log.info(
            "R2 orphan scan: bucket={} dryRun={} executeDeleteRequested={} extFilter={} r2Objects={} dbKeys={} orphans={} orphanBytes={}",
            props.bucketName,
            dryRun,
            executeDelete,
            extSet?.toString() ?: "all",
            r2Objects.size,
            dbKeys.size,
            orphans.size,
            orphanTotalBytes,
        )
        if (orphans.isEmpty()) {
            log.info("R2 orphan cleanup: no orphan objects in scope.")
        } else {
            log.info("R2 orphan cleanup: candidate keys (showing up to {} of {}):", sample.size, orphans.size)
            sample.forEach { k ->
                log.info("  orphan key={} sizeBytes={}", k, sizeByKey[k] ?: 0L)
            }
            if (orphans.size > sampleLimit) {
                log.info("  ... {} more keys omitted from log", orphans.size - sampleLimit)
            }
            log.info("R2 orphan total size bytes={} (~{} MB)", orphanTotalBytes, orphanTotalBytes / (1024 * 1024))
        }

        val canDelete = !dryRun && executeDelete && allowExecuteDeleteFromConfig
        val message = when {
            dryRun ->
                "드라이 런: 삭제 없음. 실제 삭제는 dryRun=false, executeDelete=true, 그리고 pickty.image-cleanup.allow-execute-delete=true 가 필요합니다."
            executeDelete && !allowExecuteDeleteFromConfig ->
                "설정상 실제 삭제 비허용: application 에 pickty.image-cleanup.allow-execute-delete=true 를 넣은 뒤 재시도하세요."
            executeDelete && allowExecuteDeleteFromConfig ->
                "요청에 따라 R2 에서 orphan 객체를 삭제했습니다."
            else ->
                "dryRun=false 이지만 executeDelete=false 라 삭제하지 않았습니다."
        }

        var deleted = 0
        if (canDelete && orphans.isNotEmpty()) {
            deleted = deleteOrphans(orphanKeys)
            log.warn("R2 orphan DELETE executed: deletedCount={} bucket={}", deleted, props.bucketName)
        } else if (!dryRun && executeDelete && !allowExecuteDeleteFromConfig) {
            log.warn("R2 orphan DELETE skipped: pickty.image-cleanup.allow-execute-delete is false")
        }

        ImageCleanupReport(
            dryRun = dryRun,
            executeDeleteRequested = executeDelete,
            executeDeleteAllowedByConfig = allowExecuteDeleteFromConfig,
            extensionFilter = extSet?.sorted()?.toList() ?: emptyList(),
            r2ObjectCount = r2Objects.size,
            dbReferencedKeyCount = dbKeys.size,
            orphanCount = orphans.size,
            orphanTotalBytes = orphanTotalBytes,
            orphanKeysSample = sample,
            deletedCount = deleted,
            message = message,
        )
    }

    private fun listAllR2Objects(): List<Pair<String, Long>> {
        val out = ArrayList<Pair<String, Long>>(4096)
        var token: String? = null
        do {
            var b = ListObjectsV2Request.builder().bucket(props.bucketName)
            if (token != null) {
                b = b.continuationToken(token)
            }
            val req = b.build()
            val resp = s3Client.listObjectsV2(req)
            resp.contents()?.forEach { obj: S3Object ->
                val key = obj.key() ?: return@forEach
                if (key.contains('/') || key.contains('\\') || key == "") return@forEach
                if (!R2ImageStorageService.STORED_OBJECT_KEY_REGEX.matches(key.lowercase())) return@forEach
                out.add(key to (obj.size() ?: 0L))
            }
            token = if (resp.isTruncated == true) resp.nextContinuationToken() else null
        } while (token != null)
        return out
    }

    private fun deleteOrphanKeys(key: String) {
        /*
         * 실제 삭제는 아래 한 줄이며, 운영 안전을 위해 [canDelete] 게이트와 함께만 호출된다.
         * 로컬에서만 시험할 때는 [pickty.image-cleanup.allow-execute-delete]=true 로 켠 뒤
         * dryRun=false & executeDelete=true 로 호출한다.
         */
        s3Client.deleteObject(
            DeleteObjectRequest.builder()
                .bucket(props.bucketName)
                .key(key)
                .build(),
        )
    }

    private fun deleteOrphans(keys: List<String>): Int {
        var n = 0
        for (key in keys) {
            deleteOrphanKeys(key)
            n++
        }
        return n
    }
}
