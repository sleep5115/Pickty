package com.pickty.server.domain.community.controller

import com.pickty.server.domain.community.service.CommunityPostService
import com.pickty.server.domain.community.dto.BoardPostDetailResponse
import com.pickty.server.domain.community.dto.BoardPostSummaryResponse
import com.pickty.server.domain.community.dto.CreateBoardPostRequest
import com.pickty.server.domain.community.dto.CreateBoardPostResponse
import com.pickty.server.global.security.resolveUserId
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/community/posts")
class CommunityPostController(
    private val communityPostService: CommunityPostService,
) {
    @PostMapping
    fun create(
        @Valid @RequestBody body: CreateBoardPostRequest,
        authentication: Authentication?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<CreateBoardPostResponse> {
        val userId = resolveUserId(authentication)
        return ResponseEntity.status(HttpStatus.CREATED).body(
            communityPostService.create(userId, body, httpRequest),
        )
    }

    @GetMapping
    fun list(
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Page<BoardPostSummaryResponse> {
        val safeSize = size.coerceIn(1, 100)
        val safePage = page.coerceAtLeast(0)
        val pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt"))
        return communityPostService.list(pageable)
    }

    @GetMapping("/{id}")
    fun get(@PathVariable id: UUID): BoardPostDetailResponse = communityPostService.get(id)
}