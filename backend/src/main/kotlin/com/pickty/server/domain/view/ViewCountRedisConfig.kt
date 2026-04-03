package com.pickty.server.domain.view

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.data.redis.core.script.DefaultRedisScript

@Configuration
class ViewCountRedisConfig {

    @Bean
    fun viewCountHashDrainScript(): DefaultRedisScript<List<*>> {
        val script = DefaultRedisScript<List<*>>()
        @Suppress("UNCHECKED_CAST")
        val listClass = List::class.java as Class<List<*>>
        script.setScriptText(
            """
            local h = KEYS[1]
            local all = redis.call('HGETALL', h)
            local out = {}
            local i = 1
            while i <= #all do
              local field = all[i]
              local raw = all[i + 1]
              i = i + 2
              local n = tonumber(raw)
              if n and n > 0 then
                redis.call('HDEL', h, field)
                table.insert(out, field)
                table.insert(out, tostring(n))
              end
            end
            return out
            """.trimIndent(),
        )
        script.resultType = listClass
        return script
    }
}
