package com.pickty.server.domain.community

import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Index
import jakarta.persistence.Table
import java.util.UUID

/**
 * 다형성 반응. [targetId] 는 [targetType] 이 가리키는 엔티티의 PK 이나,
 * DB FK 는 걸지 않음 — 서비스에서 대상 존재·소프트삭제·권한을 검증한다.
 *
 * DB 유니크: 회원 `(target_type, target_id, user_id)`;
 * 비회원 `(target_type, target_id, guest_ip_hash)` 는 `user_id IS NULL` 인 행에만 부분 유니크.
 * 회원 행에도 동일 IP 해시를 저장할 수 있어, 비회원 조회 시 로그인 반응과 매칭해 꼼수 중복을 막는다.
 */
@Entity
@Table(
    name = "reactions",
    indexes = [
        Index(name = "ix_reactions_target", columnList = "target_type,target_id"),
    ],
)
class Reaction(
    targetType: ReactionTargetType,
    targetId: UUID,
    reactionType: ReactionType,
    userId: Long? = null,
    guestIpHash: String? = null,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    var id: UUID? = null
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 32)
    var targetType: ReactionTargetType = targetType
        protected set

    @Column(name = "target_id", nullable = false, columnDefinition = "uuid")
    var targetId: UUID = targetId
        protected set

    @Column(name = "user_id")
    var userId: Long? = userId
        protected set

    @Column(name = "guest_ip_hash", length = 64)
    var guestIpHash: String? = guestIpHash
        protected set

    @Enumerated(EnumType.STRING)
    @Column(name = "reaction_type", nullable = false, length = 16)
    var reactionType: ReactionType = reactionType
        protected set

    /** 추천 ↔ 비추천 전환 시 서비스에서 호출 (setter 는 protected) */
    fun changeReactionType(to: ReactionType) {
        reactionType = to
    }

    /** 레거시 회원 row 에 IP 해시가 없을 때만 채움 (하이브리드 중복 방지) */
    fun ensureGuestIpHashIfMember(hash: String) {
        if (userId != null && guestIpHash == null) {
            guestIpHash = hash
        }
    }
}
