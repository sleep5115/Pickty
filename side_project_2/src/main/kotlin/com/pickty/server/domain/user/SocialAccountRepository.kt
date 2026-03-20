package com.pickty.server.domain.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.Optional

interface SocialAccountRepository : JpaRepository<SocialAccount, Long> {
    fun findByProviderAndProviderId(provider: Provider, providerId: String): Optional<SocialAccount>
    fun existsByProviderAndProviderId(provider: Provider, providerId: String): Boolean
}
