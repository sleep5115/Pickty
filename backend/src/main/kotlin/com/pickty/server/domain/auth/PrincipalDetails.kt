package com.pickty.server.domain.auth

import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.core.user.OAuth2User

class PrincipalDetails(
    val userId: Long,
    val email: String?,
    private val attributes: Map<String, Any>,
    private val authorities: Collection<GrantedAuthority> = listOf(SimpleGrantedAuthority("ROLE_USER")),
) : OAuth2User {
    override fun getAttributes(): Map<String, Any> = attributes
    override fun getAuthorities(): Collection<GrantedAuthority> = authorities
    override fun getName(): String = userId.toString()
}
