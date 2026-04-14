package com.pickty.server.domain.tier.service

import com.pickty.server.domain.tier.dto.TierResultResponse
import org.springframework.data.redis.core.StringRedisTemplate
import org.springframework.stereotype.Service
import tools.jackson.core.type.TypeReference
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.time.Duration
import java.util.UUID

/**
 * GET /tiers/results/{id} 응답 캐시. 인기 결과·통계 조회 확장 시 동일 키 패턴 재사용 가능.
 */
@Service
class TierResultCacheService(
    private val redisTemplate: StringRedisTemplate,
) {
    private val jsonMapper: JsonMapper = JsonMapper.builder()
        .addModule(kotlinModule())
        .build()
    companion object {
        private const val PREFIX = "tier:result:"
        private val TTL: Duration = Duration.ofMinutes(5)
    }

    fun getCached(id: UUID): TierResultResponse? {
        val raw = redisTemplate.opsForValue().get(key(id)) ?: return null
        return runCatching {
            jsonMapper.readValue(raw, object : TypeReference<TierResultResponse>() {})
        }.getOrNull()
    }

    fun put(id: UUID, response: TierResultResponse) {
        val json = jsonMapper.writeValueAsString(response)
        redisTemplate.opsForValue().set(key(id), json, TTL)
    }

    fun evict(id: UUID) {
        redisTemplate.delete(key(id))
    }

    private fun key(id: UUID) = "$PREFIX$id"
}
