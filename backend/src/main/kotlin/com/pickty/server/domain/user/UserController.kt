package com.pickty.server.domain.user

import com.pickty.server.domain.user.dto.CompleteOnboardingRequest
import com.pickty.server.domain.user.dto.UpdateProfileRequest
import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
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

    @GetMapping("/me/sensitive")
    fun getSensitiveProfile(authentication: Authentication): ResponseEntity<UserSensitiveProfileResponse> {
        val userId = authentication.principal as Long
        return ResponseEntity.ok(userService.getSensitiveProfile(userId))
    }

    @PatchMapping("/me/onboarding")
    fun completeOnboarding(
        authentication: Authentication,
        @Valid @RequestBody body: CompleteOnboardingRequest,
    ): ResponseEntity<UserResponse> {
        val userId = authentication.principal as Long
        userService.completeOnboarding(userId, body)
        return ResponseEntity.ok(userService.getMe(userId))
    }

    @PatchMapping("/me/profile")
    fun updateProfile(
        authentication: Authentication,
        @Valid @RequestBody body: UpdateProfileRequest,
    ): ResponseEntity<UserResponse> {
        val userId = authentication.principal as Long
        userService.updateProfile(userId, body)
        return ResponseEntity.ok(userService.getMe(userId))
    }

    @GetMapping("/me/oauth-raw")
    fun getOAuthRaw(authentication: Authentication): ResponseEntity<Map<String, Any?>> {
        val userId = authentication.principal as Long
        val raw = userService.getOAuthRaw(userId) ?: return ResponseEntity.noContent().build()
        return ResponseEntity.ok(raw)
    }
}
