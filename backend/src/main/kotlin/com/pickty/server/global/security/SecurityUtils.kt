package com.pickty.server.global.security

import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.web.server.ResponseStatusException

fun resolveUserId(authentication: Authentication?): Long? {
    val principal = authentication?.principal ?: return null
    return principal as? Long
}

fun resolveUserIdOrThrow(authentication: Authentication?): Long =
    resolveUserId(authentication)
        ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "login required")

fun isAdmin(authentication: Authentication?): Boolean =
    authentication?.authorities?.any { it.authority == "ROLE_ADMIN" } == true
