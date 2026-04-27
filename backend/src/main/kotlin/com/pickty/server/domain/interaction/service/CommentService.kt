package com.pickty.server.domain.interaction.service

import com.pickty.server.domain.interaction.dto.CommentResponse
import com.pickty.server.domain.interaction.dto.CreateCommentRequest
import com.pickty.server.domain.interaction.dto.CreateCommentResponse
import com.pickty.server.domain.community.repository.CommunityPostRepository
import com.pickty.server.domain.community.enums.CommunityPostStatus
import com.pickty.server.domain.interaction.entity.Comment
import com.pickty.server.domain.interaction.repository.CommentRepository
import com.pickty.server.domain.interaction.enums.CommentStatus
import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.tier.enums.ResultStatus
import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.tier.service.TierResultCacheService
import com.pickty.server.domain.tier.repository.TierResultRepository
import com.pickty.server.domain.tier.repository.TierTemplateRepository
import com.pickty.server.domain.user.repository.UserRepository
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import com.pickty.server.global.util.IpPrefixFormatter
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID
import kotlin.collections.get

@Service
class CommentService(
    private val commentRepository: CommentRepository,
    private val userRepository: UserRepository,
    private val tierTemplateRepository: TierTemplateRepository,
    private val tierResultRepository: TierResultRepository,
    private val communityPostRepository: CommunityPostRepository,
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    private val passwordEncoder: PasswordEncoder,
    private val tierResultCacheService: TierResultCacheService,
) {

    @Transactional
    fun createComment(
        userId: Long?,
        request: CreateCommentRequest,
        httpRequest: HttpServletRequest,
    ): CreateCommentResponse {
        assertCommentTargetSupported(request.targetType)
        assertTargetActiveForComment(request.targetType, request.targetId)

        val parent =
            request.parentCommentId?.let { pid ->
                val p =
                    commentRepository.findById(pid).orElse(null)
                        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "부모 댓글을 찾을 수 없습니다.")
                if (p.targetType != request.targetType || p.targetId != request.targetId) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "부모 댓글과 대상이 일치하지 않습니다.")
                }
                if (p.parent != null) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "대댓글에는 답글을 달 수 없습니다.")
                }
                p
            }

        val entity =
            if (userId != null) {
                Comment(
                    targetType = request.targetType,
                    targetId = request.targetId,
                    body = request.body.trim(),
                    userId = userId,
                    parent = parent,
                )
            } else {
                val clientIp = ClientIpResolver.resolve(httpRequest)
                if (clientIp == "unknown") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "클라이언트 IP 를 확인할 수 없습니다.")
                }
                val ipHash = Sha256Hex.hash(clientIp)
                val ipPrefix = IpPrefixFormatter.firstTwoSegments(clientIp)
                val displayNameRaw =
                    request.authorName?.trim().takeUnless { it.isNullOrEmpty() }
                        ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 입력해주세요.")
                if (displayNameRaw.length < 2 || displayNameRaw.length > 10) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 입력해주세요.")
                }
                val displayName = displayNameRaw
                val pwd = request.guestPassword?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                if (pwd.length < 4) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                }
                Comment(
                    targetType = request.targetType,
                    targetId = request.targetId,
                    body = request.body.trim(),
                    userId = null,
                    parent = parent,
                    authorName = displayName,
                    authorIpPrefix = ipPrefix,
                    guestPassword = passwordEncoder.encode(pwd),
                    guestIpHash = ipHash,
                )
            }

        val saved = commentRepository.save(entity)
        bumpCommentCount(request.targetType, request.targetId)
        evictResultCacheIfNeeded(request.targetType, request.targetId)
        return CreateCommentResponse(id = saved.id!!)
    }

    @Transactional(readOnly = true)
    fun listCommentsPage(
        targetType: ReactionTargetType,
        targetId: UUID,
        pageable: Pageable,
    ): Page<CommentResponse> {
        val page =
            commentRepository.findAllByTargetTypeAndTargetIdAndCommentStatusOrderByCreatedAtAsc(
                targetType,
                targetId,
                CommentStatus.ACTIVE,
                pageable,
            )
        val userIds = page.content.mapNotNull { it.userId }.toSet()
        val nickById = userRepository.findAllById(userIds).associate { it.id to it.nickname }
        val mapped = page.content.map { c -> toCommentResponse(c, nickById) }
        return PageImpl(mapped, page.pageable, page.totalElements)
    }

    @Transactional
    fun deleteComment(commentId: UUID, userId: Long?, guestPassword: String?, isAdmin: Boolean) {
        val c =
            commentRepository.findById(commentId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "댓글을 찾을 수 없습니다.")
        if (c.commentStatus == CommentStatus.DELETED) {
            return
        }
        if (isAdmin) {
            val targetType = c.targetType
            val targetId = c.targetId
            c.markDeleted()
            decrementCommentCount(targetType, targetId)
            evictResultCacheIfNeeded(targetType, targetId)
            return
        }
        when {
            c.userId != null -> {
                if (userId == null || c.userId != userId) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.")
                }
            }
            else -> {
                val pwd = guestPassword?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                if (pwd.length < 4) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                }
                val hash = c.guestPassword
                    ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "삭제할 수 없습니다.")
                if (!passwordEncoder.matches(pwd, hash)) {
                    throw ResponseStatusException(HttpStatus.FORBIDDEN, "비밀번호가 일치하지 않습니다.")
                }
            }
        }
        val targetType = c.targetType
        val targetId = c.targetId
        c.markDeleted()
        decrementCommentCount(targetType, targetId)
        evictResultCacheIfNeeded(targetType, targetId)
    }

    private fun toCommentResponse(c: Comment, nickById: Map<Long, String>): CommentResponse =
        if (c.userId != null) {
            CommentResponse(
                id = c.id!!,
                body = c.body,
                parentCommentId = c.parent?.id,
                createdAt = c.createdAt,
                authorName = null,
                authorIpPrefix = null,
                memberNickname = nickById[c.userId],
                authorUserId = c.userId,
            )
        } else {
            CommentResponse(
                id = c.id!!,
                body = c.body,
                parentCommentId = c.parent?.id,
                createdAt = c.createdAt,
                authorName = c.authorName,
                authorIpPrefix = c.authorIpPrefix,
                memberNickname = null,
                authorUserId = null,
            )
        }

    private fun evictResultCacheIfNeeded(targetType: ReactionTargetType, targetId: UUID) {
        if (targetType == ReactionTargetType.TIER_RESULT) {
            tierResultCacheService.evict(targetId)
        }
    }

    private fun assertCommentTargetSupported(targetType: ReactionTargetType) {
        when (targetType) {
            ReactionTargetType.TIER_TEMPLATE,
            ReactionTargetType.TIER_RESULT,
            ReactionTargetType.COMMUNITY_POST,
            ReactionTargetType.WORLDCUP_TEMPLATE,
            -> Unit

            ReactionTargetType.WORLDCUP_RESULT ->
                throw ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "아직 이 대상에는 댓글을 지원하지 않습니다.")
        }
    }

    private fun assertTargetActiveForComment(targetType: ReactionTargetType, targetId: UUID) {
        when (targetType) {
            ReactionTargetType.TIER_TEMPLATE -> {
                val t = tierTemplateRepository.findById(targetId).orElse(null)
                    ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "템플릿을 찾을 수 없습니다.")
                if (t.templateStatus != TemplateStatus.ACTIVE) {
                    throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
                }
            }

            ReactionTargetType.TIER_RESULT -> {
                val r = tierResultRepository.findById(targetId).orElse(null)
                    ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "티어 결과를 찾을 수 없습니다.")
                if (r.resultStatus != ResultStatus.ACTIVE) {
                    throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 목록에서 제외된 결과입니다.")
                }
            }

            ReactionTargetType.COMMUNITY_POST -> {
                communityPostRepository.findByIdAndStatus(targetId, CommunityPostStatus.ACTIVE)
                    ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.")
            }

            ReactionTargetType.WORLDCUP_TEMPLATE -> {
                val t =
                    worldCupTemplateRepository.findById(targetId).orElse(null)
                        ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
                if (t.templateStatus != TemplateStatus.ACTIVE) {
                    throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
                }
            }

            ReactionTargetType.WORLDCUP_RESULT ->
                throw ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "아직 이 대상에는 댓글을 지원하지 않습니다.")
        }
    }

    private fun bumpCommentCount(targetType: ReactionTargetType, targetId: UUID) {
        val rows =
            when (targetType) {
                ReactionTargetType.TIER_TEMPLATE -> tierTemplateRepository.incrementCommentCount(targetId)
                ReactionTargetType.TIER_RESULT -> tierResultRepository.incrementCommentCount(targetId)
                ReactionTargetType.COMMUNITY_POST -> communityPostRepository.incrementCommentCount(targetId)
                ReactionTargetType.WORLDCUP_TEMPLATE -> worldCupTemplateRepository.incrementCommentCount(targetId)
                else -> 0
            }
        if (rows == 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "댓글 수를 갱신하지 못했습니다.")
        }
    }

    private fun decrementCommentCount(targetType: ReactionTargetType, targetId: UUID) {
        val rows =
            when (targetType) {
                ReactionTargetType.TIER_TEMPLATE -> tierTemplateRepository.decrementCommentCount(targetId)
                ReactionTargetType.TIER_RESULT -> tierResultRepository.decrementCommentCount(targetId)
                ReactionTargetType.COMMUNITY_POST -> communityPostRepository.decrementCommentCount(targetId)
                ReactionTargetType.WORLDCUP_TEMPLATE -> worldCupTemplateRepository.decrementCommentCount(targetId)
                else -> 0
            }
        if (rows == 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "댓글 수를 갱신하지 못했습니다.")
        }
    }
}
