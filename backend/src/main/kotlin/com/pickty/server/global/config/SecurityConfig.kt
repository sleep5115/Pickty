package com.pickty.server.global.config

import com.pickty.server.domain.auth.handler.OAuth2SuccessHandler
import com.pickty.server.domain.auth.service.CustomOAuth2UserService
import com.pickty.server.global.jwt.JwtAuthenticationFilter
import com.pickty.server.global.oauth2.HttpCookieOAuth2AuthorizationRequestRepository
import com.pickty.server.global.security.UnauthorizedEntryPoint
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val unauthorizedEntryPoint: UnauthorizedEntryPoint,
    private val customOAuth2UserService: CustomOAuth2UserService,
    private val oAuth2SuccessHandler: OAuth2SuccessHandler,
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
    @Value("\${app.frontend-url:http://localhost:3002}") private val frontendUrl: String,
    @Value("\${app.oauth2.allowed-frontend-origins:http://localhost:3002}") private val allowedOriginsRaw: String,
) {

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = (allowedOriginsRaw.split(",").map { it.trim() } + frontendUrl)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()

        // 공개 정적 파일: 임의 오리진에서 <img crossorigin="anonymous">·html-to-image 캡처용
        // (쿠키 없음, allowCredentials=false + pattern * 가 스펙상 허용)
        val uploadsCors = CorsConfiguration().apply {
            allowedOriginPatterns = listOf("*")
            allowedMethods = listOf("GET", "HEAD", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = false
            maxAge = 3600L
        }

        val apiCors = CorsConfiguration().apply {
            allowedOrigins = origins
            allowedOriginPatterns = listOf("http://localhost:*", "http://127.0.0.1:*")
            allowedMethods = listOf("GET", "POST", "PUT", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }

        // 더 구체적인 패턴을 먼저 등록 (/** 가 /uploads 를 가로채지 않도록)
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/uploads/**", uploadsCors)
            registerCorsConfiguration("/**", apiCors)
        }
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .exceptionHandling { it.authenticationEntryPoint(unauthorizedEntryPoint) }
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .authorizeHttpRequests { auth ->
                auth
                    // 인증이 필요한 경로만 명시적으로 잠금 (Guest First)
                    .requestMatchers(HttpMethod.GET, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/user/**").authenticated()
                    // 티어 템플릿·결과 생성은 로그인 필수 (비로그인 임시 저장 미제공)
                    .requestMatchers(HttpMethod.POST, "/api/v1/templates").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/images").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/tiers/results").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/tiers/results/mine").authenticated()
                    .anyRequest().permitAll()
            }
            .oauth2Login { oauth2 ->
                oauth2
                    .authorizationEndpoint { auth ->
                        auth.authorizationRequestRepository(cookieAuthorizationRequestRepository)
                    }
                    .userInfoEndpoint { it.userService(customOAuth2UserService) }
                    .successHandler(oAuth2SuccessHandler)
            }

        return http.build()
    }

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
}
