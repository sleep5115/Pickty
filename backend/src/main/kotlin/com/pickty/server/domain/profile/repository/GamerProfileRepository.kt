package com.pickty.server.domain.profile.repository

import com.pickty.server.domain.profile.entity.GamerProfile
import org.springframework.data.jpa.repository.JpaRepository

interface GamerProfileRepository : JpaRepository<GamerProfile, Long> {
    fun findByCustomSlug(customSlug: String): GamerProfile?
    fun existsByCustomSlug(customSlug: String): Boolean
    fun findByUserId(userId: Long): GamerProfile?
}
