package com.pickty.server.global.config

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.OctetSequenceKey
import com.nimbusds.jose.jwk.source.ImmutableJWKSet
import com.pickty.server.global.jwt.JwtProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtEncoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder
import javax.crypto.spec.SecretKeySpec

@Configuration
class JwtConfig(private val jwtProperties: JwtProperties) {

    @Bean
    fun jwtDecoder(): JwtDecoder {
        val secretKey = SecretKeySpec(jwtProperties.secret.toByteArray(Charsets.UTF_8), "HmacSHA256")
        return NimbusJwtDecoder.withSecretKey(secretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build()
    }

    @Bean
    fun jwtEncoder(): JwtEncoder {
        val secretKey = SecretKeySpec(jwtProperties.secret.toByteArray(Charsets.UTF_8), "HmacSHA256")
        val jwk = OctetSequenceKey.Builder(secretKey.encoded)
            .algorithm(JWSAlgorithm.HS256)
            .build()
        return NimbusJwtEncoder(ImmutableJWKSet(JWKSet(jwk)))
    }
}
