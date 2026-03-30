package com.pickty.server.domain.community

/** `reactions`·`comments` 다형성 타겟 구분 — DB varchar 와 동일 문자열 */
enum class ReactionTargetType {
    TIER_TEMPLATE,
    TIER_RESULT,
    WORLDCUP_TEMPLATE,
    WORLDCUP_RESULT,
    BOARD_POST,
}
