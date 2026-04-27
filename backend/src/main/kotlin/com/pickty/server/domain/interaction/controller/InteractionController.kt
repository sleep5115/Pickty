package com.pickty.server.domain.interaction.controller

import com.pickty.server.domain.interaction.service.CommentService
import com.pickty.server.domain.interaction.service.ReactionService
import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.interaction.dto.CommentResponse
import com.pickty.server.domain.interaction.dto.CreateCommentRequest
import com.pickty.server.domain.interaction.dto.CreateCommentResponse
import com.pickty.server.domain.interaction.dto.DeleteCommentRequest
import com.pickty.server.domain.interaction.dto.ReactionToggleRequest
import com.pickty.server.domain.interaction.dto.ReactionToggleResponse
import com.pickty.server.global.security.isAdmin
import com.pickty.server.global.security.resolveUserId
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Sort
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/interaction")
class InteractionController(
    private val reactionService: ReactionService,
    private val commentService: CommentService,
) {

    @PostMapping("/reactions/toggle")
    fun toggleReaction(
        @Valid @RequestBody body: ReactionToggleRequest,
        authentication: Authentication?,
        httpRequest: HttpServletRequest,
    ): ReactionToggleResponse {
        val userId = resolveUserId(authentication)
        return reactionService.toggleReaction(userId, httpRequest, body)
    }

    @PostMapping("/comments")
    fun createComment(
        @Valid @RequestBody body: CreateCommentRequest,
        authentication: Authentication?,
        httpRequest: HttpServletRequest,
    ): ResponseEntity<CreateCommentResponse> {
        val userId = resolveUserId(authentication)
        return ResponseEntity.status(HttpStatus.CREATED).body(
            commentService.createComment(userId, body, httpRequest),
        )
    }

    @GetMapping("/comments")
    fun listComments(
        @RequestParam targetType: ReactionTargetType,
        @RequestParam targetId: UUID,
        @RequestParam(defaultValue = "0") page: Int,
        @RequestParam(defaultValue = "20") size: Int,
    ): Page<CommentResponse> {
        val safeSize = size.coerceIn(1, 100)
        val safePage = page.coerceAtLeast(0)
        val pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.ASC, "createdAt"))
        return commentService.listCommentsPage(targetType, targetId, pageable)
    }

    @DeleteMapping("/comments/{id}")
    fun deleteComment(
        @PathVariable id: UUID,
        @Valid @RequestBody(required = false) body: DeleteCommentRequest?,
        authentication: Authentication?,
    ): ResponseEntity<Void> {
        val userId = resolveUserId(authentication)
        commentService.deleteComment(id, userId, body?.guestPassword, isAdmin(authentication))
        return ResponseEntity.noContent().build()
    }
}