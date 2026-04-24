package com.pickty.server.domain.ai.service

import com.pickty.server.domain.ai.dto.AiTemplateItemGenerateRequest
import com.pickty.server.domain.ai.dto.AiTemplateItemResponse
import org.springframework.stereotype.Service

@Service
class AiTemplateService {

    /** 기존 유저용 엔드포인트 — 현재 스텁. 일괄 자동 생성은 `AiGenerationService` 및 `AdminAiGenerationController` 경로 사용. */
    fun generateItems(request: AiTemplateItemGenerateRequest): List<AiTemplateItemResponse> = emptyList()
}
