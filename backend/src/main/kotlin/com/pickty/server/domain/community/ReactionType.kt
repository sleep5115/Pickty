package com.pickty.server.domain.community

/** `reactions.reaction_type` — 템플릿은 LIKE, 결과·게시판 등은 UP/DOWN 조합(앱 규칙) */
enum class ReactionType {
    LIKE,
    UPVOTE,
    DOWNVOTE,
}
