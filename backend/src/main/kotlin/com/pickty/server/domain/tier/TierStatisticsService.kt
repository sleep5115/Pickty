package com.pickty.server.domain.tier

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 템플릿별 집계·컨센서스용 뼈대.
 * - 대량 JSONB 집계는 추후 정규화 테이블 또는 배치로 이전 가능
 */
@Service
class TierStatisticsService(
    private val tierResultRepository: TierResultRepository,
) {

    @Transactional(readOnly = true)
    fun countResultsByTemplateId(templateId: UUID): Long =
        tierResultRepository.countByTemplate_IdAndResultStatus(templateId, ResultStatus.ACTIVE)

    /**
     * 추후: native query / jsonb_each 로 아이템→티어 분포 집계
     */
    @Suppress("unused")
    fun placeholderAggregateByTemplateId(templateId: UUID): Map<String, Any?> =
        mapOf("templateId" to templateId.toString(), "message" to "not implemented")
}
