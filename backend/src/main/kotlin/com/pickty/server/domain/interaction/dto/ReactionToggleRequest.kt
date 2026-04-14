package com.pickty.server.domain.interaction.dto

import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.interaction.enums.ReactionType
import java.util.UUID

data class ReactionToggleRequest(
    val targetType: ReactionTargetType,
    val targetId: UUID,
    val reactionType: ReactionType,
)
