package com.pickty.server.domain.tier

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TierTemplateRepository : JpaRepository<TierTemplate, UUID>
