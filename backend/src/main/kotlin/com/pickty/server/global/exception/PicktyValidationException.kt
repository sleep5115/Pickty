package com.pickty.server.global.exception

/** Bean Validation 외 수동 검증 실패 시 동일한 400 응답 형식으로 전달 */
class PicktyValidationException(val messages: List<String>) : RuntimeException(messages.joinToString("\n"))
