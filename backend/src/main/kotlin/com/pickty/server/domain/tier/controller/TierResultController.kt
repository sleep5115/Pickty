package com.pickty.server.domain.tier

import com.fasterxml.jackson.databind.JsonNode
import com.pickty.server.domain.tier.dto.CreateTierResultRequest
import com.pickty.server.domain.tier.dto.TierResultResponse
import com.pickty.server.domain.tier.dto.TierResultSummaryResponse
import com.pickty.server.global.security.isAdmin
import com.pickty.server.global.security.resolveUserId
import com.pickty.server.global.security.resolveUserIdOrThrow
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
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

    @GetMapping("/popular")
    fun listPopular(
        @RequestParam templateId: UUID,
        @RequestParam(defaultValue = "3") limit: Int,
        authentication: Authentication?,
    ): ResponseEntity<List<TierResultSummaryResponse>> =
        ResponseEntity.ok(
            tierResultService.getPopularResultsByTemplateId(templateId, limit, resolveUserId(authentication)),
        )

    @GetMapping
    fun listAll(
        @PageableDefault(size = 12, sort = ["createdAt"], direction = Sort.Direction.DESC)
        pageable: Pageable,
        authentication: Authentication?,
    ): ResponseEntity<Page<TierResultSummaryResponse>> =
        ResponseEntity.ok(tierResultService.listAll(pageable, resolveUserId(authentication)))

    @GetMapping("/{id}")
    fun getOne(
        @PathVariable id: UUID,
        @RequestParam(name = "countView", defaultValue = "true") countView: Boolean,
        authentication: Authentication?,
    ): ResponseEntity<TierResultResponse> =
        ResponseEntity.ok(tierResultService.getById(id, resolveUserId(authentication), countView))

    @PatchMapping("/{id}")
    fun patch(
        @PathVariable id: UUID,
        @RequestBody body: JsonNode,
        authentication: Authentication?,
    ): ResponseEntity<TierResultResponse> {
        val userId = resolveUserIdOrThrow(authentication)
        return ResponseEntity.ok(tierResultService.patchMetadata(id, userId, body))
    }

    @DeleteMapping("/{id}")
    fun delete(
        @PathVariable id: UUID,
        authentication: Authentication?,
    ): ResponseEntity<Void> {
        val userId = resolveUserIdOrThrow(authentication)
        val admin = isAdmin(authentication)
        tierResultService.delete(id, userId, admin)
        return ResponseEntity.noContent().build()
    }
}
