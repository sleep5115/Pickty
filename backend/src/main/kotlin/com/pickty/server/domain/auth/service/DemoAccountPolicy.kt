package com.pickty.server.domain.auth.service

import com.pickty.server.domain.user.entity.User
import com.pickty.server.domain.user.repository.UserRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component("demoAccountPolicy")
class DemoAccountPolicy(
    private val userRepository: UserRepository,
    @Value("\${pickty.demo-login.enabled:true}") private val enabled: Boolean,
    @Value("\${pickty.demo-login.user-email:demo-user@pickty.app}") private val demoUserEmail: String,
) {
    fun canUseAiDemo(userId: Long): Boolean {
        if (!enabled) return false
        val user = userRepository.findById(userId).orElse(null) ?: return false
        return canUseAiDemo(user)
    }

    fun canUseAiDemo(user: User): Boolean =
        enabled && user.email.equals(demoUserEmail, ignoreCase = true)
}
