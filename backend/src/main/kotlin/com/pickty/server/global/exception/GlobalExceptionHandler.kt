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
