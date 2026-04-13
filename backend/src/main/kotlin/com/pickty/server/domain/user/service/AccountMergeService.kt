package com.pickty.server.domain.user

import com.pickty.server.domain.tier.TierResultRepository
import com.pickty.server.domain.tier.TierTemplateRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * 계정 병합: **가입일(created_at)이 더 이른** [User]가 본체로 남고, 다른 쪽은 [AccountStatus.MERGED] 처리.
 */
@Service
class AccountMergeService(
    private val userRepository: UserRepository,
    private val socialAccountRepository: SocialAccountRepository,
    private val tierTemplateRepository: TierTemplateRepository,
    private val tierResultRepository: TierResultRepository,
) {

    /**
     * @param userId1 첫 번째 계정 id
     * @param userId2 두 번째 계정 id
     * @return 본체(생존) user id
     */
    @Transactional
    fun mergeAccount(userId1: Long, userId2: Long): Long {
        if (userId1 == userId2) return userId1

        val u1 = userRepository.findById(userId1)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: $userId1") }
        val u2 = userRepository.findById(userId2)
            .orElseThrow { ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: $userId2") }

        if (u1.accountStatus == AccountStatus.MERGED || u2.accountStatus == AccountStatus.MERGED) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "이미 병합된 계정은 다시 병합할 수 없습니다.")
        }
        if (u1.accountStatus == AccountStatus.DELETED || u2.accountStatus == AccountStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "삭제된 계정은 병합할 수 없습니다.")
        }

        val (survivor, absorbed) = if (!u1.createdAt.isAfter(u2.createdAt)) {
            u1 to u2
        } else {
            u2 to u1
        }

        if (survivor.id == absorbed.id) return survivor.id

        socialAccountRepository.migrateAllFromUserToUser(absorbed.id, survivor)
        tierTemplateRepository.migrateCreatorId(absorbed.id, survivor.id)
        tierResultRepository.migrateUserId(absorbed.id, survivor.id)

        // absorbed 엔티티를 save 하면 cascade/orphanRemoval 이 이관된 SocialAccount 를 삭제할 수 있음 — 벌크 UPDATE 만 사용
        userRepository.markAbsorbedSubtreeMergedAndAnonymize(
            absorbedId = absorbed.id,
            survivorId = survivor.id,
            mergedStatus = AccountStatus.MERGED.name,
        )

        return survivor.id
    }
}
