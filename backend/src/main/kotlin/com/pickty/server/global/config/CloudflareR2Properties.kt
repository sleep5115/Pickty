package com.pickty.server.global.config

import jakarta.validation.constraints.NotBlank
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.validation.annotation.Validated

@ConfigurationProperties(prefix = "cloud.cloudflare.r2")
@Validated
data class CloudflareR2Properties(
    @field:NotBlank val bucketName: String,
    @field:NotBlank val accessKey: String,
    @field:NotBlank val secretKey: String,
    @field:NotBlank val endpoint: String,
    @field:NotBlank val publicUrl: String,
)
