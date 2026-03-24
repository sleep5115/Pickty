package com.pickty.server.domain.user

import com.pickty.server.domain.user.dto.CompleteOnboardingRequest
import com.pickty.server.domain.user.dto.OAuthLinkChallengeRequest
import com.pickty.server.domain.user.dto.OAuthLinkChallengeResponse
import com.pickty.server.domain.user.dto.UpdateProfileRequest
import com.pickty.server.global.oauth2.OAuthLinkService
import jakarta.validation.Valid
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/user")
class UserController(
    private val userService: UserService,
    private val oauthLinkService: OAuthLinkService,
) {

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

    /** 소셜 연동(병합 가능)용 1회성 토큰 발급 → 프론트가 `${API}${path}` 팝업으로 연 다음 OAuth 진행 */
    @PostMapping("/me/oauth-link/challenge")
    fun createOAuthLinkChallenge(
        authentication: Authentication,
        @Valid @RequestBody body: OAuthLinkChallengeRequest,
    ): ResponseEntity<OAuthLinkChallengeResponse> {
        val userId = authentication.principal as Long
        val token = oauthLinkService.createChallenge(userId)
        val rid = body.registrationId.lowercase()
        val qT = URLEncoder.encode(token, StandardCharsets.UTF_8)
        val qR = URLEncoder.encode(rid, StandardCharsets.UTF_8)
        val path = "/oauth2/link/start?t=$qT&registrationId=$qR"
        return ResponseEntity.ok(OAuthLinkChallengeResponse(path = path))
    }
}
