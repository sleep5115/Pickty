package com.pickty.server.global.exception

import jakarta.validation.ConstraintViolationException
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleMethodArgumentNotValid(ex: MethodArgumentNotValidException): ResponseEntity<String> {
        val msg = formatFieldErrors(ex)
        return plainTextBadRequest(msg)
    }

    @ExceptionHandler(ConstraintViolationException::class)
    fun handleConstraintViolation(ex: ConstraintViolationException): ResponseEntity<String> {
        val msg = ex.constraintViolations.map { it.message }.distinct().joinToString("\n").ifBlank {
            "입력값을 확인해 주세요."
        }
        return plainTextBadRequest(msg)
    }

    @ExceptionHandler(PicktyValidationException::class)
    fun handlePicktyValidation(ex: PicktyValidationException): ResponseEntity<String> {
        val msg = ex.messages.joinToString("\n").ifBlank { "입력값을 확인해 주세요." }
        return plainTextBadRequest(msg)
    }

    @ExceptionHandler(AiQuotaExhaustedException::class)
    fun handleAiQuotaExhausted(ex: AiQuotaExhaustedException): ResponseEntity<Map<String, String>> {
        val message = ex.message?.ifBlank { null } ?: "Gemini API 일일 생성 할당량이 소진되었습니다."
        val body = mapOf(
            "code" to "AI_QUOTA_EXHAUSTED",
            "message" to message,
        )
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
            .contentType(MediaType.APPLICATION_JSON)
            .body(body)
    }

    private fun formatFieldErrors(ex: MethodArgumentNotValidException): String {
        val fromFields = ex.bindingResult.fieldErrors.mapNotNull { fe ->
            fe.defaultMessage?.takeIf { it.isNotBlank() }
        }
        if (fromFields.isNotEmpty()) {
            return fromFields.joinToString("\n")
        }
        val global = ex.bindingResult.globalErrors.mapNotNull { ge ->
            ge.defaultMessage?.takeIf { it.isNotBlank() }
        }
        if (global.isNotEmpty()) {
            return global.joinToString("\n")
        }
        return "입력값을 확인해 주세요."
    }

    private fun plainTextBadRequest(body: String): ResponseEntity<String> {
        val headers = HttpHeaders()
        headers.contentType = MediaType.parseMediaType("text/plain;charset=UTF-8")
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).headers(headers).body(body)
    }
}
