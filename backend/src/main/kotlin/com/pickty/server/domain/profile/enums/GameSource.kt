package com.pickty.server.domain.profile.enums

/** 게임 카드 정보의 출처. API 연동 / DB 검색 / AI 자연어 파싱 / 수동 직접 입력. */
enum class GameSource {
    API,
    SEARCH,
    AI,
    DIRECT,
}
