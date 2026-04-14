package com.pickty.server.domain.interaction.dto

import com.pickty.server.domain.interaction.enums.ReactionType

/** 토글 후 현재 상태(제거 시 null) */
data class ReactionToggleResponse(
    val active: Boolean,
    val reactionType: ReactionType?,
)
