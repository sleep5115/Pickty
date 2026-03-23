package com.pickty.server.global.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.kotlinModule
import org.hibernate.cfg.MappingSettings
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * Hibernate 7 + `@JdbcTypeCode(SqlTypes.JSON)` / jsonb 컬럼은 FormatMapper가 필요함.
 * Boot 4는 웹용 Jackson 3만 두는 경우가 많아 자동 탐지가 실패할 수 있어, Jackson 2 ObjectMapper로 명시 등록.
 * `kotlinModule()` — jsonb `List<String>` 등 역직렬화 안정화. (HTTP 응답 직렬화는 `tools.jackson` 과 별개)
 */
@Configuration
class HibernateJsonFormatMapperConfig {

    @Bean
    fun hibernateJacksonJsonFormatMapperCustomizer(): HibernatePropertiesCustomizer {
        val mapper = ObjectMapper().registerModule(kotlinModule())
        return HibernatePropertiesCustomizer { properties ->
            properties[MappingSettings.JSON_FORMAT_MAPPER] = JacksonJsonFormatMapper(mapper)
        }
    }
}
