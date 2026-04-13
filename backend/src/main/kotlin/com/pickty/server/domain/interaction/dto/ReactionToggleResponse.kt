package com.pickty.server.domain.community.dto

import com.pickty.server.domain.community.ReactionType

/** 토글 후 현재 상태(제거 시 null) */
data class CommunityReactionToggleResponse(
    val active: Boolean,
    val reactionType: ReactionType?,
)
