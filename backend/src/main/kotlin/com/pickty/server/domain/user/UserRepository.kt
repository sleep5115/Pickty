package com.pickty.server.domain.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): Optional<User>
    fun existsByEmail(email: String): Boolean
    fun existsByNickname(nickname: String): Boolean

    /**
     * 병합 시 흡수 계정 트리 평탄화 — [User.save] + orphanRemoval 금지.
     * `id = absorbedId` 인 행과, `merged_into_user_id` 체인으로 그 아래에 달린 모든 행(C→B→A 중 B 흡수 시 C 포함)을
     * 한꺼번에 MERGED·`merged_into_user_id = survivorId`·민감 필드 NULL 로 맞춘다.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        WITH RECURSIVE sub AS (
            SELECT id FROM users WHERE id = :absorbedId
            UNION
            SELECT u.id FROM users u
            INNER JOIN sub s ON u.merged_into_user_id = s.id
        )
        UPDATE users ust SET
            account_status = :mergedStatus,
            merged_into_user_id = :survivorId,
            email = NULL,
            user_name = NULL,
            profile_image_url = NULL
        FROM sub
        WHERE ust.id = sub.id AND ust.id <> :survivorId
        """,
        nativeQuery = true,
    )
    fun markAbsorbedSubtreeMergedAndAnonymize(
        @Param("absorbedId") absorbedId: Long,
        @Param("survivorId") survivorId: Long,
        @Param("mergedStatus") mergedStatus: String,
    ): Int

    /**
     * 본체(`survivorId`)에 직·간접 흡수된 MERGED 계정 id (탈퇴 전 소셜·토큰·Redis 정리용).
     */
    @Query(
        value = """
        WITH RECURSIVE absorbed AS (
            SELECT id FROM users
            WHERE merged_into_user_id = :survivorId AND account_status = 'MERGED'
            UNION
            SELECT u.id FROM users u
            INNER JOIN absorbed a ON u.merged_into_user_id = a.id
            WHERE u.account_status = 'MERGED'
        )
        SELECT id FROM absorbed
        """,
        nativeQuery = true,
    )
    fun findMergedDescendantUserIdsForSurvivor(@Param("survivorId") survivorId: Long): List<Long>

    /**
     * 본체 탈퇴 시, `merged_into` 체인으로 본체에 매달린 모든 MERGED 행을 DELETED·비식별화.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        value = """
        WITH RECURSIVE absorbed AS (
            SELECT id FROM users
            WHERE merged_into_user_id = :survivorId AND account_status = 'MERGED'
            UNION
            SELECT u.id FROM users u
            INNER JOIN absorbed a ON u.merged_into_user_id = a.id
            WHERE u.account_status = 'MERGED'
        )
        UPDATE users ust SET
            account_status = 'DELETED',
            email = NULL,
            user_name = NULL,
            profile_image_url = NULL,
            merged_into_user_id = NULL
        FROM absorbed
        WHERE ust.id = absorbed.id
        """,
        nativeQuery = true,
    )
    fun finalizeAllMergedDescendantsWhenSurvivorWithdraws(@Param("survivorId") survivorId: Long): Int
}
