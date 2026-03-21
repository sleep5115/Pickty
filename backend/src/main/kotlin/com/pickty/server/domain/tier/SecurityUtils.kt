package com.pickty.server.domain.tier

import org.springframework.security.core.Authentication

fun resolveUserId(authentication: Authentication?): Long? {
    val principal = authentication?.principal ?: return null
    return principal as? Long
}
