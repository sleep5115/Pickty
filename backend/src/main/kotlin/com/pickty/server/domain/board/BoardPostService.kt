package com.pickty.server.domain.board

import com.pickty.server.domain.board.dto.BoardPostCommentsPageResponse
import com.pickty.server.domain.board.dto.BoardPostDetailResponse
import com.pickty.server.domain.board.dto.BoardPostSummaryResponse
import com.pickty.server.domain.board.dto.CreateBoardPostRequest
import com.pickty.server.domain.board.dto.CreateBoardPostResponse
import com.pickty.server.domain.community.CommunityCommentService
import com.pickty.server.domain.community.ReactionTargetType
import com.pickty.server.domain.user.UserRepository
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
class BoardPostService(
    private val boardPostRepository: BoardPostRepository,
    private val userRepository: UserRepository,
    private val passwordEncoder: PasswordEncoder,
    private val boardHtmlSanitizer: BoardHtmlSanitizer,
    private val communityCommentService: CommunityCommentService,
) {
    companion object {
        private const val BOARD_POST_COMMENTS_PAGE_SIZE = 30
    }
    @Transactional
    fun create(
        userId: Long?,
        request: CreateBoardPostRequest,
        httpRequest: HttpServletRequest,
    ): CreateBoardPostResponse {
        val sanitized = boardHtmlSanitizer.sanitize(request.contentHtml)
        val title = request.title.trim()
        if (title.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "제목을 입력해 주세요.")
        }
        if (sanitized.isBlank()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "본문을 입력해 주세요.")
        }

        val entity =
            if (userId != null) {
                BoardPost(
                    title = title,
                    contentHtml = sanitized,
                    authorId = userId,
                )
            } else {
                val clientIp = ClientIpResolver.resolve(httpRequest)
                if (clientIp == "unknown") {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "클라이언트 IP 를 확인할 수 없습니다.")
                }
                val guestPassword = request.guestPassword?.trim().takeUnless { it.isNullOrEmpty() }
                    ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "비회원 글에는 비밀번호가 필요합니다.")
                val nick = request.guestNickname?.trim().takeUnless { it.isNullOrEmpty() } ?: "익명"
                BoardPost(
                    title = title,
                    contentHtml = sanitized,
                    authorId = null,
                    guestNickname = nick,
                    guestPasswordHash = passwordEncoder.encode(guestPassword),
                    guestIpHash = Sha256Hex.hash(clientIp),
                    guestIpPrefix = IpPrefixFormatter.firstTwoSegments(clientIp),
                )
            }

        val saved = boardPostRepository.save(entity)
        return CreateBoardPostResponse(id = saved.id!!)
    }

    @Transactional(readOnly = true)
    fun list(pageable: Pageable): Page<BoardPostSummaryResponse> {
        val page = boardPostRepository.findAllByStatusOrderByCreatedAtDesc(BoardPostStatus.ACTIVE, pageable)
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
        val any = boardPostRepository.findById(id).orElse(null)
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "게시글을 찾을 수 없습니다.")
        if (any.status == BoardPostStatus.DELETED) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제된 게시글입니다.")
        }
        val user = any.authorId?.let { userRepository.findById(it).orElse(null) }
        any.incrementViewCount()
        val postId = any.id!!
        val commentPage =
            communityCommentService.listCommentsPage(
                ReactionTargetType.BOARD_POST,
                postId,
                PageRequest.of(0, BOARD_POST_COMMENTS_PAGE_SIZE),
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
