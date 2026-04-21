package com.pickty.server.domain.interaction.service

import com.pickty.server.domain.interaction.entity.Reaction
import com.pickty.server.domain.interaction.repository.ReactionRepository
import com.pickty.server.domain.interaction.enums.ReactionTargetType
import com.pickty.server.domain.interaction.enums.ReactionType
import com.pickty.server.domain.interaction.dto.ReactionToggleResponse
import com.pickty.server.domain.interaction.dto.ReactionToggleRequest
import com.pickty.server.domain.tier.enums.ResultStatus
import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.tier.service.TierResultCacheService
import com.pickty.server.domain.tier.repository.TierResultRepository
import com.pickty.server.domain.tier.repository.TierTemplateRepository
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException
import java.util.UUID

@Service
class ReactionService(
    private val reactionRepository: ReactionRepository,
    private val tierTemplateRepository: TierTemplateRepository,
    private val tierResultRepository: TierResultRepository,
    private val tierResultCacheService: TierResultCacheService,
) {

    @Transactional
    fun toggleReaction(
        userId: Long?,
        httpRequest: HttpServletRequest,
        request: ReactionToggleRequest,
    ): ReactionToggleResponse {
        validateTargetAndReactionKind(request.targetType, request.reactionType)
        assertTargetActive(request.targetType, request.targetId)

        val ip = ClientIpResolver.resolve(httpRequest)
        if (ip == "unknown") {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "클라이언트 IP 를 확인할 수 없습니다.")
        }
        val guestHash = Sha256Hex.hash(ip)

        val existing =
            if (userId != null) {
                reactionRepository.findByTargetTypeAndTargetIdAndUserId(
                    request.targetType,
                    request.targetId,
                    userId,
                )
            } else {
                val guestRow = reactionRepository.findByTargetTypeAndTargetIdAndGuestIpHashAndUserIdIsNull(
                    request.targetType,
                    request.targetId,
                    guestHash,
                )
                guestRow ?: run {
                    val memberAtIp = reactionRepository.findFirstByTargetTypeAndTargetIdAndGuestIpHashAndUserIdIsNotNull(
                        request.targetType,
                        request.targetId,
                        guestHash,
                    )
                    if (memberAtIp != null) {
                        throw ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "이 단말·IP에서 이미 회원 계정으로 반응했습니다. 로그인한 상태에서 변경해 주세요.",
                        )
                    }
                    null
                }
            }

        if (existing != null && existing.userId != null) {
            existing.ensureGuestIpHashIfMember(guestHash)
        }

        when {
            existing == null -> {
                reactionRepository.save(
                    Reaction(
                        targetType = request.targetType,
                        targetId = request.targetId,
                        reactionType = request.reactionType,
                        userId = userId,
                        guestIpHash = guestHash,
                    ),
                )
                applyCountDelta(request.targetType, request.targetId, request.reactionType, +1)
                evictTierResultDetailCache(request.targetType, request.targetId)
                return ReactionToggleResponse(active = true, reactionType = request.reactionType)
            }

            existing.reactionType == request.reactionType -> {
                reactionRepository.delete(existing)
                applyCountDelta(request.targetType, request.targetId, request.reactionType, -1)
                evictTierResultDetailCache(request.targetType, request.targetId)
                return ReactionToggleResponse(active = false, reactionType = null)
            }

            else -> {
                if (request.targetType != ReactionTargetType.TIER_RESULT) {
                    throw ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "이 대상에서는 반응 종류를 전환할 수 없습니다.",
                    )
                }
                applyVoteSwitch(request.targetId, existing.reactionType, request.reactionType)
                existing.changeReactionType(request.reactionType)
                evictTierResultDetailCache(request.targetType, request.targetId)
                return ReactionToggleResponse(active = true, reactionType = request.reactionType)
            }
        }
    }

    private fun evictTierResultDetailCache(targetType: ReactionTargetType, targetId: UUID) {
        if (targetType == ReactionTargetType.TIER_RESULT) {
            tierResultCacheService.evict(targetId)
        }
    }

    private fun validateTargetAndReactionKind(
        targetType: ReactionTargetType,
        reactionType: ReactionType,
    ) {
        when (targetType) {
            ReactionTargetType.TIER_TEMPLATE ->
                if (reactionType != ReactionType.LIKE) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "템플릿에는 좋아요만 가능합니다.")
                }

            ReactionTargetType.TIER_RESULT ->
                if (reactionType != ReactionType.UPVOTE && reactionType != ReactionType.DOWNVOTE) {
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "티어 결과에는 추천/비추천만 가능합니다.")
                }

            ReactionTargetType.WORLDCUP_TEMPLATE,
            ReactionTargetType.WORLDCUP_RESULT,
            ReactionTargetType.community_post,
            ->
                throw ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "아직 이 대상에는 반응을 지원하지 않습니다.")
        }
    }

    private fun assertTargetActive(targetType: ReactionTargetType, targetId: UUID) {
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

            else -> throw ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "지원하지 않는 대상입니다.")
        }
    }

    private fun applyCountDelta(
        targetType: ReactionTargetType,
        targetId: UUID,
        reactionType: ReactionType,
        delta: Long,
    ) {
        val rows =
            when (targetType) {
                ReactionTargetType.TIER_TEMPLATE ->
                    when (reactionType) {
                        ReactionType.LIKE ->
                            tierTemplateRepository.adjustLikeCount(targetId, delta)

                        else -> 0
                    }

                ReactionTargetType.TIER_RESULT ->
                    when (reactionType) {
                        ReactionType.UPVOTE ->
                            tierResultRepository.adjustVoteCounts(targetId, delta, 0L)

                        ReactionType.DOWNVOTE ->
                            tierResultRepository.adjustVoteCounts(targetId, 0L, delta)

                        else -> 0
                    }

                else -> 0
            }
        if (rows == 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "반응 카운트를 갱신하지 못했습니다. 대상 상태를 확인하세요.")
        }
    }

    private fun applyVoteSwitch(
        targetId: UUID,
        from: ReactionType,
        to: ReactionType,
    ) {
        val (dUp, dDown) =
            when {
                from == ReactionType.UPVOTE && to == ReactionType.DOWNVOTE ->
                    -1L to 1L

                from == ReactionType.DOWNVOTE && to == ReactionType.UPVOTE ->
                    1L to -1L

                else ->
                    throw ResponseStatusException(HttpStatus.BAD_REQUEST, "허용되지 않는 투표 전환입니다.")
            }
        val rows = tierResultRepository.adjustVoteCounts(targetId, dUp, dDown)
        if (rows == 0) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "투표 수를 갱신하지 못했습니다.")
        }
    }
}
