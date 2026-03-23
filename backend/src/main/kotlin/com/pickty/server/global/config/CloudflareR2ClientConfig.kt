package com.pickty.server.global.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import java.net.URI

@Configuration
class CloudflareR2ClientConfig(
    private val props: CloudflareR2Properties,
) {

    @Bean
    fun r2S3Client(): S3Client {
        val creds = AwsBasicCredentials.create(props.accessKey, props.secretKey)
        return S3Client.builder()
            .credentialsProvider(StaticCredentialsProvider.create(creds))
            .endpointOverride(URI.create(props.endpoint))
            .region(Region.of("auto"))
            .serviceConfiguration(
                S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .build(),
            )
            .build()
    }
}
