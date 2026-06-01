package com.pickty.server.domain.streamer.valkey

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.core.script.DefaultRedisScript

/**
 * 모든 상태 변경을 1 RTT로 묶기 위한 Lua 스크립트 모음.
 * Lightsail 2GB 환경에서 Valkey 명령 라운드트립 비용을 최소화한다.
 */
@Configuration
class StreamerValkeyConfig {

    /**
     * 방장 액션 1건: 임의 필드 갱신 + version+1 + lastActiveTime 갱신 + TTL 재설정.
     * KEYS[1] = sessionMeta hash key
     * ARGV[1] = TTL seconds
     * ARGV[2] = lastActiveTime epoch seconds
     * ARGV[3] = 갱신 필드 pair 개수 N
     * ARGV[4..]= field1, value1, field2, value2 ...
     * @return 새 version
     */
    @Bean
    fun streamerSessionBumpScript(): DefaultRedisScript<Long> {
        val script = DefaultRedisScript<Long>()
        script.setScriptText(
            """
            local key = KEYS[1]
            local ttl = tonumber(ARGV[1])
            local now = ARGV[2]
            local n = tonumber(ARGV[3])
            if redis.call('EXISTS', key) == 0 then
              return -1
            end
            local i = 1
            while i <= n do
              local f = ARGV[3 + (i * 2) - 1]
              local v = ARGV[3 + (i * 2)]
              if v == '__DEL__' then
                redis.call('HDEL', key, f)
              else
                redis.call('HSET', key, f, v)
              end
              i = i + 1
            end
            local nv = redis.call('HINCRBY', key, 'version', 1)
            redis.call('HSET', key, 'lastActiveTime', now)
            redis.call('EXPIRE', key, ttl)
            return nv
            """.trimIndent(),
        )
        script.resultType = Long::class.java
        return script
    }

    /**
     * 매치 단위 1인 1표 + 카운트. visitorKey가 처음 보이면 HINCRBY 후 1 반환, 중복이면 0 반환.
     * KEYS[1] = votersSet, KEYS[2] = matchVotesHash
     * ARGV[1] = visitorKey, ARGV[2] = selectedField, ARGV[3] = TTL seconds
     */
    @Bean
    fun streamerVoteOnceScript(): DefaultRedisScript<Long> {
        val script = DefaultRedisScript<Long>()
        script.setScriptText(
            """
            local voters = KEYS[1]
            local votes = KEYS[2]
            local visitor = ARGV[1]
            local field = ARGV[2]
            local ttl = tonumber(ARGV[3])
            local added = redis.call('SADD', voters, visitor)
            if added == 0 then
              return 0
            end
            redis.call('EXPIRE', voters, ttl)
            redis.call('HINCRBY', votes, field, 1)
            redis.call('EXPIRE', votes, ttl)
            return 1
            """.trimIndent(),
        )
        script.resultType = Long::class.java
        return script
    }

    /**
     * 시청자 폴링 1건당 HLL 슬라이딩 윈도우 갱신 + 최근 2분 누적 동접자 PFCOUNT 한방.
     * KEYS[1] = 현재 분 키, KEYS[2] = 직전 분 키
     * ARGV[1] = visitorKey(해시), ARGV[2] = TTL seconds (>= 180 권장)
     * @return 최근 2분 union cardinality
     */
    @Bean
    fun streamerActiveTouchScript(): DefaultRedisScript<Long> {
        val script = DefaultRedisScript<Long>()
        script.setScriptText(
            """
            local k1 = KEYS[1]
            local k2 = KEYS[2]
            local v = ARGV[1]
            local ttl = tonumber(ARGV[2])
            redis.call('PFADD', k1, v)
            redis.call('EXPIRE', k1, ttl)
            return redis.call('PFCOUNT', k1, k2)
            """.trimIndent(),
        )
        script.resultType = Long::class.java
        return script
    }

    /**
     * 티어표 시청자 완성본 1인 1제출 + 아이템별 등급 카운트.
     * 같은 visitorKey가 이미 제출했으면 0 반환(집계 미반영), 신규면 모든 아이템 HINCRBY 후 1 반환.
     * KEYS[1] = tierSubmittedVoters set
     * ARGV[1] = visitorKey
     * ARGV[2] = TTL seconds
     * ARGV[3] = tierStatsItem 키 prefix (예: "streamer:session:{id}:tier-stats:")
     * ARGV[4] = placement 쌍 개수 N
     * ARGV[5..] = itemId1, grade1, itemId2, grade2 ...
     *
     * 단일 Valkey 인스턴스(Lightsail) 가정 — Lua 내부에서 키를 동적 구성한다.
     */
    @Bean
    fun streamerTierSubmitScript(): DefaultRedisScript<Long> {
        val script = DefaultRedisScript<Long>()
        script.setScriptText(
            """
            local voters = KEYS[1]
            local visitor = ARGV[1]
            local ttl = tonumber(ARGV[2])
            local prefix = ARGV[3]
            local n = tonumber(ARGV[4])
            local added = redis.call('SADD', voters, visitor)
            if added == 0 then
              return 0
            end
            redis.call('EXPIRE', voters, ttl)
            local i = 1
            while i <= n do
              local itemId = ARGV[4 + (i * 2) - 1]
              local grade = ARGV[4 + (i * 2)]
              local k = prefix .. itemId
              redis.call('HINCRBY', k, grade, 1)
              redis.call('EXPIRE', k, ttl)
              i = i + 1
            end
            return 1
            """.trimIndent(),
        )
        script.resultType = Long::class.java
        return script
    }

    /**
     * SSE 티켓 검증 즉시 파기 (GETDEL). 존재 시 hostToken 반환, 없으면 nil.
     * KEYS[1] = sseTicket key
     */
    @Bean
    fun streamerTicketConsumeScript(): DefaultRedisScript<String> {
        val script = DefaultRedisScript<String>()
        script.setScriptText(
            """
            local v = redis.call('GET', KEYS[1])
            if v then
              redis.call('DEL', KEYS[1])
            end
            return v
            """.trimIndent(),
        )
        script.resultType = String::class.java
        return script
    }
}
