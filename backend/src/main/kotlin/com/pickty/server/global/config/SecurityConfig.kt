package com.pickty.server.global.config

import com.pickty.server.domain.auth.handler.OAuth2SuccessHandler
import com.pickty.server.domain.auth.service.CustomOAuth2UserService
import com.pickty.server.global.jwt.JwtAuthenticationFilter
import com.pickty.server.global.oauth2.HttpCookieOAuth2AuthorizationRequestRepository
import com.pickty.server.global.security.UnauthorizedEntryPoint
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

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val unauthorizedEntryPoint: UnauthorizedEntryPoint,
    private val customOAuth2UserService: CustomOAuth2UserService,
    private val oAuth2SuccessHandler: OAuth2SuccessHandler,
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val cookieAuthorizationRequestRepository: HttpCookieOAuth2AuthorizationRequestRepository,
) {

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
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
