package com.pickty.server.domain.community.dto

import com.pickty.server.domain.community.ReactionTargetType
import com.pickty.server.domain.community.ReactionType
import java.util.UUID

data class ToggleReactionRequest(
    val targetType: ReactionTargetType,
    val targetId: UUID,
    val reactionType: ReactionType,
)
