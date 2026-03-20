package com.pickty.server.domain.user

import org.springframework.stereotype.Service

@Service
class UserService(
    private val userRepository: UserRepository,
    private val socialAccountRepository: SocialAccountRepository,
) {
    fun getMe(userId: Long): UserResponse {
        val user = userRepository.findById(userId)
            .orElseThrow { NoSuchElementException("User not found: $userId") }
        val providers = socialAccountRepository.findAllByUser_Id(userId)
            .map { it.provider.name }
        return UserResponse(
            id = user.id!!,
            email = user.email,
            nickname = user.nickname,
            profileImageUrl = user.profileImageUrl,
            role = user.role.name,
            providers = providers,
            createdAt = user.createdAt.toString(),
        )
    }
}
