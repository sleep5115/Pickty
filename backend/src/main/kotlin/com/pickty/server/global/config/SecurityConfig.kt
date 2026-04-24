package com.pickty.server.global.config

import com.pickty.server.domain.auth.handler.OAuth2FailureHandler
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
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
class SecurityConfig(
    private val unauthorizedEntryPoint: UnauthorizedEntryPoint,
    private val customOAuth2UserService: CustomOAuth2UserService,
    private val oAuth2SuccessHandler: OAuth2SuccessHandler,
    private val oAuth2FailureHandler: OAuth2FailureHandler,
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
    @Value("\${app.frontend-url:https://pickty.app}") private val frontendUrl: String,
    @Value("\${app.oauth2.allowed-frontend-origins:https://pickty.app,https://www.pickty.app,http://localhost:3002,http://127.0.0.1:3002}") private val allowedOriginsRaw: String,
) {

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = (allowedOriginsRaw.split(",").map { it.trim() } + frontendUrl)
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .distinct()

        val apiCors = CorsConfiguration().apply {
            allowedOrigins = origins
            allowedOriginPatterns = listOf(
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://pickty.app",
                "https://www.pickty.app",
            )
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
        }

        return UrlBasedCorsConfigurationSource().apply {
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
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/oauth-exchange").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/refresh").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/logout").permitAll()
                    .requestMatchers(HttpMethod.GET, "/oauth2/link/start").permitAll()
                    // 인증이 필요한 경로만 명시적으로 잠금 (Guest First)
                    .requestMatchers(HttpMethod.GET, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.PUT, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/user/**").authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/user/**").authenticated()
                    // 티어 템플릿·결과 생성은 로그인 필수 (비로그인 임시 저장 미제공)
                    .requestMatchers(HttpMethod.POST, "/api/v1/templates").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/templates/mine").authenticated()
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/templates/**").authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/templates/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/worldcup/templates").authenticated()
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/worldcup/templates/**").authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/worldcup/templates/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/images").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/tiers/results").authenticated()
                    .requestMatchers(HttpMethod.GET, "/api/v1/tiers/results/mine").authenticated()
                    .requestMatchers(HttpMethod.PATCH, "/api/v1/tiers/results/**").authenticated()
                    .requestMatchers(HttpMethod.DELETE, "/api/v1/tiers/results/**").authenticated()
                    // AI 자동 생성
                    .requestMatchers("/api/v1/ai/**").authenticated()
                    .requestMatchers(HttpMethod.POST, "/api/v1/admin/**").authenticated()
                    .anyRequest().permitAll()
            }
            .oauth2Login { oauth2 ->
                oauth2
                    .authorizationEndpoint { auth ->
                        auth.authorizationRequestRepository(cookieAuthorizationRequestRepository)
                    }
                    .userInfoEndpoint { it.userService(customOAuth2UserService) }
                    .successHandler(oAuth2SuccessHandler)
                    .failureHandler(oAuth2FailureHandler)
            }

        return http.build()
    }
}
