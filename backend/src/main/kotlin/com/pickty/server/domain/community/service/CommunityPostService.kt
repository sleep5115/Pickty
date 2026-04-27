package com.pickty.server.domain.community.service

import com.pickty.server.domain.community.support.CommunityHtmlSanitizer
import com.pickty.server.domain.community.repository.CommunityPostRepository
import com.pickty.server.domain.community.enums.CommunityPostStatus
import com.pickty.server.domain.community.dto.BoardPostCommentsPageResponse
import com.pickty.server.domain.community.dto.BoardPostDetailResponse
import com.pickty.server.domain.community.dto.BoardPostSummaryResponse
import com.pickty.server.domain.community.dto.CreateBoardPostRequest
import com.pickty.server.domain.community.dto.CreateBoardPostResponse
import com.pickty.server.domain.community.dto.UpdateBoardPostRequest
import com.pickty.server.domain.community.entity.CommunityPost
import com.pickty.server.domain.interaction.service.CommentService
import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.user.repository.UserRepository
import com.pickty.server.global.util.IpPrefixFormatter
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class CommunityPostService(
    private val communityPostRepository: CommunityPostRepository,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val communityHtmlSanitizer: CommunityHtmlSanitizer,
    private val commentService: CommentService,
) {
    companion object {
        private const val COMMUNITY_POST_COMMENTS_PAGE_SIZE = 30
    }

    @Transactional
    fun create(
        userId: Long?,
        request: CreateBoardPostRequest,
        httpRequest: HttpServletRequest,
    ): CreateBoardPostResponse {
        val sanitized = communityHtmlSanitizer.sanitize(request.contentHtml)
        val title = request.title.trim()
        if (title.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "제목을 입력해 주세요.")
        }
        if (!communityHtmlSanitizer.hasMeaningfulTextOrEmbeddedMedia(sanitized)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "본문을 입력해 주세요.")
        }

        val entity =
            if (userId != null) {
                CommunityPost(
                    title = title,
                    contentHtml = sanitized,
                    authorId = userId,
                )
            } else {
                val clientIp = ClientIpResolver.resolve(httpRequest)
                if (clientIp == "unknown") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "클라이언트 IP 를 확인할 수 없습니다.")
                }
                val nick =
                    request.guestNickname?.trim().takeUnless { it.isNullOrEmpty() }
                        ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 입력해주세요.")
                if (nick.length < 2 || nick.length > 10) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "닉네임을 입력해주세요.")
                }
                val guestPassword = request.guestPassword?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                if (guestPassword.length < 4) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
                }
                CommunityPost(
                    title = title,
                    contentHtml = sanitized,
                    authorId = null,
                    guestNickname = nick,
                    guestPasswordHash = passwordEncoder.encode(guestPassword),
                    guestIpHash = Sha256Hex.hash(clientIp),
                    guestIpPrefix = IpPrefixFormatter.firstTwoSegments(clientIp),
                )
            }

        val saved = communityPostRepository.save(entity)
        return CreateBoardPostResponse(id = saved.id!!)
    }

    @Transactional(readOnly = true)
    fun list(pageable: Pageable): Page<BoardPostSummaryResponse> {
        val page = communityPostRepository.findAllByStatusOrderByCreatedAtDesc(CommunityPostStatus.ACTIVE, pageable)
        val authorIds = page.content.mapNotNull { it.authorId }.toSet()
        val usersById = userRepository.findAllById(authorIds).associateBy { it.id }
        return page.map { post ->
            val user = post.authorId?.let { usersById[it] }
            BoardPostSummaryResponse(
                id = post.id!!,
                title = post.title,
                viewCount = post.viewCount,
                createdAt = post.createdAt.toString(),
                authorUserId = post.authorId,
                authorNickname = user?.nickname ?: (post.guestNickname ?: "익명"),
                authorIpPrefix = if (post.authorId == null) post.guestIpPrefix else null,
            )
        }
    }

    @Transactional
    fun get(id: UUID): BoardPostDetailResponse {
        val any = loadPostOrThrow(id)
        if (any.status == CommunityPostStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제된 게시글입니다.")
        }
        any.incrementViewCount()
        return buildBoardPostDetail(any)
    }

    @Transactional
    fun update(
        id: UUID,
        userId: Long?,
        request: UpdateBoardPostRequest,
    ): BoardPostDetailResponse {
        val any = loadActivePostOrThrow(id)
        assertCanUpdatePost(any, userId, request.guestPassword)

        val title = request.title.trim()
        if (title.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "제목을 입력해 주세요.")
        }
        val sanitized = communityHtmlSanitizer.sanitize(request.contentHtml)
        if (!communityHtmlSanitizer.hasMeaningfulTextOrEmbeddedMedia(sanitized)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "본문을 입력해 주세요.")
        }
        any.applyTitleAndHtml(title, sanitized)
        return buildBoardPostDetail(any)
    }

    @Transactional
    fun delete(
        id: UUID,
        userId: Long?,
        isAdmin: Boolean,
        guestPasswordPlain: String?,
    ) {
        val any = communityPostRepository.findById(id).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.")
        if (any.status == CommunityPostStatus.DELETED) {
            return
        }
        if (isAdmin) {
            any.markDeleted()
            return
        }
        if (any.authorId != null) {
            if (userId == null || userId != any.authorId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "삭제할 수 없습니다.")
            }
            any.markDeleted()
            return
        }
        val pwd = guestPasswordPlain?.trim().takeUnless { it.isNullOrEmpty() }
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
        if (pwd.length < 4) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비밀번호를 입력해주세요.")
        }
        val hash = any.guestPasswordHash
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "삭제할 수 없습니다.")
        if (!passwordEncoder.matches(pwd, hash)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "비밀번호가 일치하지 않습니다.")
        }
        any.markDeleted()
    }

    private fun loadPostOrThrow(id: UUID): CommunityPost =
        communityPostRepository.findById(id).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.")

    private fun loadActivePostOrThrow(id: UUID): CommunityPost {
        val any = loadPostOrThrow(id)
        if (any.status == CommunityPostStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제된 게시글입니다.")
        }
        return any
    }

    private fun assertCanUpdatePost(post: CommunityPost, userId: Long?, guestPasswordPlain: String?) {
        if (post.authorId != null) {
            // 회원 글: 본인 ID 일치만 허용(관리자 포함, 타인 글·비로그인은 전부 거절)
            if (userId == null || userId != post.authorId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "수정할 수 없습니다.")
            }
            return
        }
        // 비회원 글: guestPassword 필수·일치만 허용(없거나 틀리면 403으로 통일)
        val pwd = guestPasswordPlain?.trim().takeUnless { it.isNullOrEmpty() }
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "비밀번호를 입력해주세요.")
        if (pwd.length < 4) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "비밀번호를 입력해주세요.")
        }
        val hash = post.guestPasswordHash
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "수정할 수 없습니다.")
        if (!passwordEncoder.matches(pwd, hash)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "비밀번호가 일치하지 않습니다.")
        }
    }

    private fun buildBoardPostDetail(any: CommunityPost): BoardPostDetailResponse {
        val user = any.authorId?.let { userRepository.findById(it).orElse(null) }
        val postId = any.id!!
        val commentPage =
            commentService.listCommentsPage(
                ReactionTargetType.COMMUNITY_POST,
                postId,
                PageRequest.of(0, COMMUNITY_POST_COMMENTS_PAGE_SIZE),
            )
        return BoardPostDetailResponse(
            id = postId,
            title = any.title,
            contentHtml = any.contentHtml,
            viewCount = any.viewCount,
            commentCount = any.commentCount,
            createdAt = any.createdAt.toString(),
            updatedAt = any.updatedAt.toString(),
            authorUserId = any.authorId,
            authorNickname = user?.nickname ?: (any.guestNickname ?: "익명"),
            authorIpPrefix = if (any.authorId == null) any.guestIpPrefix else null,
            authorAvatarUrl = user?.displayAvatarUrl,
            comments =
                BoardPostCommentsPageResponse(
                    content = commentPage.content,
                    totalElements = commentPage.totalElements,
                    totalPages = commentPage.totalPages,
                    size = commentPage.size,
                    number = commentPage.number,
                    first = commentPage.isFirst,
                    last = commentPage.isLast,
                    empty = commentPage.isEmpty,
                ),
        )
    }
}
