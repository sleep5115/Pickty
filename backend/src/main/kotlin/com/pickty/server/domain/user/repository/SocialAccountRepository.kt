package com.pickty.server.domain.user.repository

import com.pickty.server.domain.user.enums.Provider
import com.pickty.server.domain.user.entity.SocialAccount
import com.pickty.server.domain.user.entity.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.Optional

interface SocialAccountRepository : JpaRepository<SocialAccount, Long> {
    fun findByProviderAndProviderId(provider: Provider, providerId: String): Optional<SocialAccount>
    fun existsByProviderAndProviderId(provider: Provider, providerId: String): Boolean
    fun findAllByUser_Id(userId: Long): List<SocialAccount>

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        UPDATE SocialAccount s SET s.user = :toUser WHERE s.user.id = :fromUserId
        """,
    )
    fun migrateAllFromUserToUser(
        @Param("fromUserId") fromUserId: Long,
        @Param("toUser") toUser: User,
    ): Int

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM SocialAccount s WHERE s.user.id = :userId")
    fun deleteAllByUserId(@Param("userId") userId: Long): Int
}
