package com.pickty.server.domain.interaction

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class MyReactionService(
    private val reactionRepository: ReactionRepository,
) {

    @Transactional(readOnly = true)
    fun mapByTargetIds(
        targetType: ReactionTargetType,
        targetIds: Collection<UUID>,
        userId: Long?,
    ): Map<UUID, ReactionType> {
        if (userId == null || targetIds.isEmpty()) return emptyMap()
        val distinct = targetIds.distinct()
        if (distinct.isEmpty()) return emptyMap()
        return reactionRepository
            .findByTargetTypeAndTargetIdInAndUserId(targetType, distinct, userId)
            .associate { it.targetId to it.reactionType }
    }

    @Transactional(readOnly = true)
    fun single(
        targetType: ReactionTargetType,
        targetId: UUID,
        userId: Long?,
    ): ReactionType? = mapByTargetIds(targetType, listOf(targetId), userId)[targetId]
}
