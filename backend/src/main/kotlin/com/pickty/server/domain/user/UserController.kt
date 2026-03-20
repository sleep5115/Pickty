package com.pickty.server.domain.user

import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/user")
class UserController(private val userService: UserService) {

    @GetMapping("/me")
    fun getMe(authentication: Authentication): ResponseEntity<UserResponse> {
        val userId = authentication.principal as Long
        return ResponseEntity.ok(userService.getMe(userId))
    }

    @GetMapping("/me/oauth-raw")
    fun getOAuthRaw(authentication: Authentication): ResponseEntity<Map<String, Any?>> {
        val userId = authentication.principal as Long
        val raw = userService.getOAuthRaw(userId) ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok(raw)
    }
}
