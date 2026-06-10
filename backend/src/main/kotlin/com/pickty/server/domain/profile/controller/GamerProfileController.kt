package com.pickty.server.domain.profile.controller

import com.pickty.server.domain.profile.dto.GamerProfileAiGenerateRequest
import com.pickty.server.domain.profile.dto.GamerProfileAiGenerateResponse
import com.pickty.server.domain.profile.dto.GamerProfileCreateRequest
import com.pickty.server.domain.profile.dto.GamerProfileCreateResponse
import com.pickty.server.domain.profile.dto.GamerProfileGameStatsRequest
import com.pickty.server.domain.profile.dto.GamerProfileGameStatsResponse
import com.pickty.server.domain.profile.dto.GamerProfileResponse
import com.pickty.server.domain.profile.dto.GamerProfileSlugCheckResponse
import com.pickty.server.domain.profile.dto.GamerProfileUpdateRequest
import com.pickty.server.domain.profile.dto.GamerProfileVerifyPasswordRequest
import com.pickty.server.domain.profile.dto.GamerProfileVerifyPasswordResponse
import com.pickty.server.domain.profile.service.GameStatsService
import com.pickty.server.domain.profile.service.GamerProfileAiService
import com.pickty.server.domain.profile.service.GamerProfileRateLimiter
import com.pickty.server.domain.profile.service.GamerProfileService
import com.pickty.server.global.security.resolveUserId
import com.pickty.server.global.security.resolveUserIdOrThrow
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

/**
 * 게임인생프로필 공개/편집 API.
 *
 * 모든 경로는 SecurityConfig 기본 permitAll(비회원 우선)이며, 생성/수정 권한은
 * 서비스 레이어에서 (회원=user_id 일치 / 비회원=X-Profile-Edit-Token)으로 세부 제어한다.
 */
@RestController
@RequestMapping("/api/v1/profile")
class GamerProfileController(
    private val gamerProfileService: GamerProfileService,
    private val gamerProfileAiService: GamerProfileAiService,
    private val gameStatsService: GameStatsService,
    private val rateLimiter: GamerProfileRateLimiter,
) {

    /** 주소 ID 중복·형식 확인 (생성 화면 실시간 체크). */
    @GetMapping("/check-slug")
    fun checkSlug(@RequestParam("slug") slug: String): GamerProfileSlugCheckResponse =
        gamerProfileService.checkSlug(slug)

    /** 로그인 회원 본인 프로필의 슬러그 (프론트 /profile/my 리디렉션용). */
    @GetMapping("/me")
    fun myProfile(authentication: Authentication?): Map<String, String> {
        val userId = resolveUserIdOrThrow(authentication)
        return mapOf("slug" to gamerProfileService.getMySlug(userId))
    }

    @GetMapping("/{slug}")
    fun get(@PathVariable slug: String): GamerProfileResponse =
        gamerProfileService.getBySlug(slug)

    @PostMapping
    fun create(
        @Valid @RequestBody request: GamerProfileCreateRequest,
        authentication: Authentication?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<GamerProfileCreateResponse> {
        val userId = resolveUserId(authentication)
        val response = gamerProfileService.create(userId, request, httpRequest)
        return ResponseEntity.status(HttpStatus.CREATED).body(response)
    }

    @PutMapping("/{slug}")
    fun update(
        @PathVariable slug: String,
        @Valid @RequestBody request: GamerProfileUpdateRequest,
        @RequestHeader(value = "X-Profile-Edit-Token", required = false) editToken: String?,
        authentication: Authentication?,
    ): GamerProfileResponse {
        val userId = resolveUserId(authentication)
        return gamerProfileService.update(slug, userId, editToken, request)
    }

    @PostMapping("/{slug}/verify-password")
    fun verifyPassword(
        @PathVariable slug: String,
        @Valid @RequestBody request: GamerProfileVerifyPasswordRequest,
    ): GamerProfileVerifyPasswordResponse =
        gamerProfileService.verifyPassword(slug, request.password)

    /** AI 자연어 → 구조화 카드. 비회원 개방 + IP 하루 5회 제한(초과·쿼터소진 시 429 → 수동 폼 폴백). */
    @PostMapping("/ai-generate")
    fun aiGenerate(
        @Valid @RequestBody request: GamerProfileAiGenerateRequest,
        httpRequest: HttpServletRequest,
    ): GamerProfileAiGenerateResponse {
        rateLimiter.checkAiGenerate(ipHashOf(httpRequest))
        return gamerProfileAiService.parseCards(request.text)
    }

    /** 외부 게임 API 조회(LoL/오버워치). 키 미설정·실패 시 Mock 데이터로 채워 반환. */
    @PostMapping("/game-stats")
    fun gameStats(
        @Valid @RequestBody request: GamerProfileGameStatsRequest,
    ): GamerProfileGameStatsResponse =
        gameStatsService.fetch(request.gameSlug, request.identifier)

    private fun ipHashOf(httpRequest: HttpServletRequest): String {
        val clientIp = ClientIpResolver.resolve(httpRequest)
        return if (clientIp == "unknown") "unknown" else Sha256Hex.hash(clientIp)
    }
}
