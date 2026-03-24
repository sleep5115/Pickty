package com.pickty.server.global.oauth2

object OAuthLinkConstants {
    /** 값 형식: `{userId}|{registrationId}` (예: `42|kakao`). 짧은 TTL + registrationId 일치 시에만 연동 모드로 인정 */
    const val OAUTH_LINK_COOKIE = "pickty_oauth_link"

    const val REDIS_KEY_PREFIX = "oauth2:link:"
    const val REDIS_TTL_SECONDS = 600L
    const val LINK_COOKIE_MAX_AGE_SECONDS = 120
}
