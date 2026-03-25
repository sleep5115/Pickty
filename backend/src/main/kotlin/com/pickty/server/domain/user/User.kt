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
import java.time.LocalDateTime
import org.hibernate.annotations.ColumnDefault

@Entity
@Table(name = "users")
class User(
    email: String?,
    nickname: String,
    profileImageUrl: String?,
    role: Role = Role.USER,
    userName: String? = null,
    accountStatus: AccountStatus = AccountStatus.ACTIVE,
    gender: Gender? = null,
    birthYear: Int? = null,
) : BaseTimeEntity() {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long = 0

    /** 소셜 제공 실명 등 — 관리·내부용 (화면 노출 최소화 정책과 병행) */
    @Column(name = "user_name")
    var userName: String? = userName
        protected set

    // 소셜 전용 유저는 null 가능. PostgreSQL은 nullable unique 컬럼에서 NULL 중복 허용
    @Column(unique = true)
    var email: String? = email
        protected set

    @Column(nullable = false)
    var nickname: String = nickname
        protected set

    /** 소셜 제공 프로필 이미지 URL (내부·민감 패널 참고용). 공개 노출은 [displayAvatarUrl] 사용. */
    @Column(name = "profile_image_url")
    var profileImageUrl: String? = profileImageUrl
        protected set

    /** 온보딩에서 업로드(R2 등) 후 저장한 공개용 아바타 URL */
    @Column(name = "display_avatar_url")
    var displayAvatarUrl: String? = null
        protected set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    @ColumnDefault("'ACTIVE'")
    var accountStatus: AccountStatus = accountStatus
        protected set

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    var gender: Gender? = gender
        protected set

    @Column(name = "birth_year")
    var birthYear: Int? = birthYear
        protected set

    /** 온보딩 완료 시각. null 이면 공개 아바타(`display_avatar_url`) 미노출. */
    @Column(name = "onboarding_completed_at")
    var onboardingCompletedAt: LocalDateTime? = null
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

    /** 소셜에서 받은 이미지 링크를 `profile_image_url` 에만 보강 */
    fun applyOAuthProfileImageIfMissing(url: String?) {
        if (profileImageUrl.isNullOrBlank() && !url.isNullOrBlank()) {
            this.profileImageUrl = url
        }
    }

    fun promoteToAdmin() {
        this.role = Role.ADMIN
    }

    /** 소셜 측 실명 등 → `user_name` 만 보강. 닉네임과는 무관. */
    fun applyOAuthUserNameIfMissing(name: String?) {
        if (userName.isNullOrBlank() && !name.isNullOrBlank()) {
            this.userName = name
        }
    }

    fun completeOnboarding(
        nickname: String,
        displayAvatarUrl: String?,
        gender: Gender?,
        birthYear: Int?,
    ) {
        require(accountStatus == AccountStatus.PENDING) {
            "온보딩은 PENDING 상태에서만 완료할 수 있습니다."
        }
        this.nickname = nickname
        this.displayAvatarUrl = displayAvatarUrl?.trim()?.takeIf { it.isNotEmpty() }
        this.gender = gender
        this.birthYear = birthYear
        this.accountStatus = AccountStatus.ACTIVE
        this.onboardingCompletedAt = LocalDateTime.now()
    }

    /** 온보딩 완료 후 공개 프로필(닉네임·공개 아바타·생년·성별)만 수정 */
    fun updatePublicProfile(
        nickname: String,
        displayAvatarUrl: String?,
        gender: Gender?,
        birthYear: Int?,
    ) {
        require(accountStatus == AccountStatus.ACTIVE) {
            "활성 계정만 프로필을 수정할 수 있습니다."
        }
        this.nickname = nickname.trim()
        this.displayAvatarUrl = displayAvatarUrl?.trim()?.takeIf { it.isNotEmpty() }
        this.gender = gender
        this.birthYear = birthYear
    }

    /** 계정 병합으로 흡수된 계정 — 로그인·JWT 대상에서 제외 */
    fun markAccountMerged() {
        require(accountStatus != AccountStatus.MERGED) { "이미 병합 처리된 계정입니다." }
        require(accountStatus != AccountStatus.DELETED) { "삭제된 계정은 병합할 수 없습니다." }
        this.accountStatus = AccountStatus.MERGED
    }

    /**
     * 회원 탈퇴(소프트 딜리트) — 소셜 연동 레코드는 별도 삭제 후 호출.
     * [nickname]·[displayAvatarUrl] 은 사이트 내 공개 프로필(템플릿·결과 등 표시용)이므로 유지한다.
     */
    fun anonymizeForWithdrawal() {
        require(accountStatus != AccountStatus.MERGED) { "병합된 계정은 탈퇴할 수 없습니다." }
        require(accountStatus != AccountStatus.DELETED) { "이미 탈퇴 처리된 계정입니다." }
        this.accountStatus = AccountStatus.DELETED
        this.email = null
        this.userName = null
        this.profileImageUrl = null
    }
}
