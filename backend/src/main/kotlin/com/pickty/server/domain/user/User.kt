package com.pickty.server.domain.user

import com.pickty.server.global.common.BaseTimeEntity
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.Table

@Entity
@Table(name = "users")
class User(
    email: String?,
    password: String?,
    nickname: String,
    profileImageUrl: String?,
    role: Role = Role.USER,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0

    // 소셜 전용 유저는 null 가능. PostgreSQL은 nullable unique 컬럼에서 NULL 중복 허용
    @Column(unique = true)
    var email: String? = email
        protected set

    // 자체 로그인 전용. 소셜 전용 유저는 null
    @Column
    var password: String? = password
        protected set

    @Column(nullable = false)
    var nickname: String = nickname
        protected set

    @Column
    var profileImageUrl: String? = profileImageUrl
        protected set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var role: Role = role
        protected set

    @OneToMany(mappedBy = "user", cascade = [CascadeType.ALL], orphanRemoval = true)
    private val _socialAccounts: MutableList<SocialAccount> = mutableListOf()

    val socialAccounts: List<SocialAccount>
        get() = _socialAccounts.toList()

    fun addSocialAccount(socialAccount: SocialAccount) {
        _socialAccounts.add(socialAccount)
    }

    fun removeSocialAccount(provider: Provider) {
        _socialAccounts.removeIf { it.provider == provider }
    }

    fun updateNickname(nickname: String) {
        this.nickname = nickname
    }

    fun updateProfileImage(url: String?) {
        this.profileImageUrl = url
    }

    fun updatePassword(encodedPassword: String) {
        this.password = encodedPassword
    }

    fun promoteToAdmin() {
        this.role = Role.ADMIN
    }
}
