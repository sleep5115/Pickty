package com.pickty.server.domain.upload.support

import com.pickty.server.domain.upload.service.R2ImageStorageService
import com.pickty.server.global.config.CloudflareR2Properties
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Component

/**
 * DB에 등장하는 R2 객체 키(UUID 파일명)를 수집한다.
 * - 컬럼 URL: [com.pickty.server.global.config.CloudflareR2Properties.publicUrl] 접두 + 키 형식
 * - JSONB: PostgreSQL regexp 로 동일 형식 토막 추출
 */
@Component
class ImageReferencedKeysReader(
    private val jdbc: JdbcTemplate,
    private val props: CloudflareR2Properties,
) {

    private val publicBase = props.publicUrl.trimEnd('/')

    /** Postgres POSIX 정규식 — [com.pickty.server.domain.upload.service.R2ImageStorageService] 가 저장하는 확장자와 맞춤 */
    private val pgKeyPattern =
        "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(png|jpg|jpeg|webp|gif|bin))"

    private val jsonKeySql =
        """
        SELECT DISTINCT lower(m[1]) AS k
        FROM tier_templates t,
        LATERAL regexp_matches(t.items::text, '$pgKeyPattern', 'gi') AS m
        UNION
        SELECT DISTINCT lower(m[1]) AS k
        FROM tier_templates t,
        LATERAL regexp_matches(t.board_config::text, '$pgKeyPattern', 'gi') AS m
        WHERE t.board_config IS NOT NULL
        UNION
        SELECT DISTINCT lower(m[1]) AS k
        FROM tier_results r,
        LATERAL regexp_matches(r.snapshot_data::text, '$pgKeyPattern', 'gi') AS m
        """.trimIndent()

    fun loadAllReferencedKeys(): Set<String> = buildSet {
        addKeysFromUrlColumn(
            "SELECT display_avatar_url FROM users WHERE display_avatar_url IS NOT NULL AND trim(display_avatar_url) <> ''",
        )
        addKeysFromUrlColumn(
            "SELECT thumbnail_url FROM tier_templates WHERE thumbnail_url IS NOT NULL AND trim(thumbnail_url) <> ''",
        )
        addKeysFromUrlColumn(
            "SELECT thumbnail_url FROM tier_results WHERE thumbnail_url IS NOT NULL AND trim(thumbnail_url) <> ''",
        )
        jdbc.query(jsonKeySql) { rs, _ ->
            val k = rs.getString("k")?.lowercase()?.trim()
            if (!k.isNullOrEmpty()) add(k)
        }
    }

    private fun MutableSet<String>.addKeysFromUrlColumn(sql: String) {
        jdbc.query(sql) { rs, _ ->
            addAll(keysFromUrlOrPlain(rs.getString(1)))
        }
    }

    private fun keysFromUrlOrPlain(raw: String?): Set<String> {
        if (raw.isNullOrBlank()) return emptySet()
        val t = raw.trim()
        val out = linkedSetOf<String>()
        if (t.startsWith(publicBase, ignoreCase = true)) {
            val path = t.substring(publicBase.length).trimStart('/').substringBefore('?').substringBefore('#')
            if (R2ImageStorageService.Companion.STORED_OBJECT_KEY_REGEX.matches(path)) {
                out.add(path.lowercase())
            }
        }
        R2ImageStorageService.Companion.STORED_OBJECT_KEY_FRAGMENT_REGEX.findAll(t).forEach { m ->
            val candidate = m.value.lowercase()
            if (R2ImageStorageService.Companion.STORED_OBJECT_KEY_REGEX.matches(candidate)) {
                out.add(candidate)
            }
        }
        return out
    }
}