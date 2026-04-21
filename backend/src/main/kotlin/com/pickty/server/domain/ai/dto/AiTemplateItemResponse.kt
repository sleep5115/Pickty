package com.pickty.server.domain.ai.dto

data class AiTemplateItemResponse(
    val id: String,
    val name: String,
    val imageUrl: String? = null,
    val focusRect: FocusRect? = null,
)

data class FocusRect(
    val x: Double,
    val y: Double,
    val w: Double,
    val h: Double,
)
