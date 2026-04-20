package com.pickty.server.domain.worldcup.service

import com.pickty.server.domain.tier.enums.TemplateStatus
import com.pickty.server.domain.worldcup.dto.WorldCupPlayResultRequest
import com.pickty.server.domain.worldcup.dto.WorldCupResultSubmitRequest
import com.pickty.server.domain.worldcup.entity.WorldCupPlayResult
import com.pickty.server.domain.worldcup.repository.WorldCupPlayResultRepository
import com.pickty.server.domain.worldcup.repository.WorldCupTemplateRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

/**
 * 월드컵 플레이 결과 제출 — 이력 DB 저장 후 동일 트랜잭션에서 템플릿·아이템 통계 누적.
 */
@Service
class WorldCupPlayResultService(
    private val worldCupTemplateRepository: WorldCupTemplateRepository,
    private val worldCupPlayResultRepository: WorldCupPlayResultRepository,
    private val worldCupStatService: WorldCupStatService,
) {

    @Transactional
    fun accept(request: WorldCupPlayResultRequest) {
        val winnerId = request.winnerItemId.trim()
        if (winnerId.isEmpty()) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "winnerItemId 가 필요합니다.")
        }

        val tpl =
            worldCupTemplateRepository.findById(request.templateId).orElse(null)
                ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "월드컵 템플릿을 찾을 수 없습니다.")
        if (tpl.templateStatus != TemplateStatus.ACTIVE) {
            throw ResponseStatusException(HttpStatus.GONE, "삭제되었거나 비공개인 템플릿입니다.")
        }

        if (!request.matchHistory.isArray) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "matchHistory 는 JSON 배열이어야 합니다.")
        }

        worldCupPlayResultRepository.save(
            WorldCupPlayResult(
                template = tpl,
                winnerItemId = winnerId,
                matchHistory = request.matchHistory,
            ),
        )

        worldCupStatService.submitPlayResult(
            request.templateId,
            WorldCupResultSubmitRequest(
                winnerItemId = winnerId,
                itemStats = request.itemStats,
            ),
        )
    }
}
