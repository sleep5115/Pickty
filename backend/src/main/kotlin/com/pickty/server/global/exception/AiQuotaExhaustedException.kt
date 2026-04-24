package com.pickty.server.global.exception

/**
 * Gemini 등 **일일 생성 할당량(GenerateRequestsPerDay 등)** 소진 시.
 * 클라이언트는 HTTP 429 + JSON `code: AI_QUOTA_EXHAUSTED` 로 구분한다.
 */
class AiQuotaExhaustedException(
    message: String = "Gemini API 일일 생성 할당량이 소진되었습니다.",
) : RuntimeException(message)
