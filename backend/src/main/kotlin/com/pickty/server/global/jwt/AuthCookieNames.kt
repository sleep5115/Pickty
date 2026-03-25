package com.pickty.server.global.jwt

object AuthCookieNames {
    /** 리프레시 토큰을 HttpOnly 쿠키로 둘 때 사용할 이름(현재는 Redis만 사용, 탈퇴 시에도 만료 헤더 발행) */
    const val REFRESH_TOKEN = "pickty_refresh_token"
}
