package com.pickty.server.domain.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

interface UserRepository : JpaRepository<User, Long> {
    fun findByEmail(email: String): Optional<User>
    fun existsByEmail(email: String): Boolean
    fun existsByNickname(nickname: String): Boolean

    /**
     * 병합 시 흡수 계정만 상태 변경 — [User.save] + orphanRemoval 으로는
     * 이미 survivor 로 FK가 옮겨진 [SocialAccount] 가 고아 삭제될 수 있음.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.accountStatus = :status WHERE u.id = :id")
    fun updateAccountStatus(@Param("id") id: Long, @Param("status") status: AccountStatus): Int
}
