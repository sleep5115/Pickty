package com.pickty.server.domain.ai.dto

import com.fasterxml.jackson.annotation.JsonProperty

data class AdminAutoGenerateRequest(
    val theme: String,
    val count: Int = 20
)

data class AdminAutoGenerateResponse(
    @get:JsonProperty("is_person_or_character")
    val isPersonOrCharacter: Boolean,
    val items: List<AdminAutoGenerateItem>
)

data class AdminAutoGenerateItem(
    val name: String,
    val imageUrls: List<String>
)

/** Gemini 응답 파싱용 */
data class GeminiThemeItemsResponse(
    @get:JsonProperty("theme_type")
    val themeType: String,
    @get:JsonProperty("is_person_or_character")
    val isPersonOrCharacter: Boolean,
    val items: List<String>
)
