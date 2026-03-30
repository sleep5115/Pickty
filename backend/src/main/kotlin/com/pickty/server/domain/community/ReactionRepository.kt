package com.pickty.server.domain.community

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface ReactionRepository : JpaRepository<Reaction, UUID> {
    fun findByTargetTypeAndTargetIdAndUserId(
        targetType: ReactionTargetType,
        targetId: UUID,
        userId: Long,
    ): Reaction?

    fun findByTargetTypeAndTargetIdInAndUserId(
        targetType: ReactionTargetType,
        targetIds: Collection<UUID>,
        userId: Long,
    ): List<Reaction>

    fun findByTargetTypeAndTargetIdAndGuestIpHash(
        targetType: ReactionTargetType,
        targetId: UUID,
        guestIpHash: String,
    ): Reaction?
}
