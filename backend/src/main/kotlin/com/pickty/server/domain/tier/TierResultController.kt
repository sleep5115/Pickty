package com.pickty.server.domain.tier

import com.pickty.server.domain.tier.dto.CreateTierResultRequest
import com.pickty.server.domain.tier.dto.TierResultResponse
import com.pickty.server.domain.tier.dto.TierResultSummaryResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tiers/results")
class TierResultController(
    private val tierResultService: TierResultService,
) {

    @PostMapping
    fun create(
        @Valid @RequestBody body: CreateTierResultRequest,
        authentication: Authentication?,
    ): ResponseEntity<TierResultResponse> {
        val userId = resolveUserId(authentication)
        val created = tierResultService.create(body, userId)
        return ResponseEntity.status(201).body(created)
    }

    @GetMapping("/mine")
    fun listMine(authentication: Authentication?): ResponseEntity<List<TierResultSummaryResponse>> {
        val userId = resolveUserId(authentication)
            ?: throw ResponseStatusException(HttpStatus.UNAUTHORIZED, "login required")
        return ResponseEntity.ok(tierResultService.listMine(userId))
    }

    @GetMapping("/{id}")
    fun getOne(@PathVariable id: UUID): ResponseEntity<TierResultResponse> =
        ResponseEntity.ok(tierResultService.getById(id))
}
