package com.pickty.server.domain.profile.service

import com.pickty.server.domain.profile.dto.GamerProfileCardRequest
import com.pickty.server.domain.profile.dto.GamerProfileCreateRequest
import com.pickty.server.domain.profile.dto.GamerProfileCreateResponse
import com.pickty.server.domain.profile.dto.GamerProfileFeedRequest
import com.pickty.server.domain.profile.dto.GamerProfileResponse
import com.pickty.server.domain.profile.dto.GamerProfileSlugCheckResponse
import com.pickty.server.domain.profile.dto.GamerProfileUpdateRequest
import com.pickty.server.domain.profile.dto.GamerProfileVerifyPasswordResponse
import com.pickty.server.domain.profile.entity.GamerProfile
import com.pickty.server.domain.profile.entity.GamerProfileCard
import com.pickty.server.domain.profile.entity.GamerProfileCardStat
import com.pickty.server.domain.profile.entity.GamerProfileFeed
import com.pickty.server.domain.profile.repository.GamerProfileRepository
import com.pickty.server.global.util.Sha256Hex
import com.pickty.server.global.web.ClientIpResolver
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.server.ResponseStatusException

@Service
class GamerProfileService(
    private val gamerProfileRepository: GamerProfileRepository,
    private val passwordEncoder: PasswordEncoder,
    private val editTokenService: GamerProfileEditTokenService,
    @Value("\${app.frontend-url:https://pickty.app}") private val frontendUrl: String,
) {
    private val publicBaseUrl: String = frontendUrl.trimEnd('/')

    // ---------- 조회 ----------

    @Transactional(readOnly = true)
    fun checkSlug(rawSlug: String): GamerProfileSlugCheckResponse {
        val slug = normalizeSlug(rawSlug)
        val available = !isReserved(slug) && isValidSlugFormat(slug) && !gamerProfileRepository.existsByCustomSlug(slug)
        return GamerProfileSlugCheckResponse(slug = slug, available = available)
    }

    @Transactional(readOnly = true)
    fun getBySlug(rawSlug: String): GamerProfileResponse {
        val profile = loadOrThrow(rawSlug)
        return GamerProfileResponse.from(profile, publicBaseUrl)
    }

    @Transactional(readOnly = true)
    fun getMySlug(userId: Long): String =
        gamerProfileRepository.findByUserId(userId)?.customSlug
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로필이 없습니다.")

    // ---------- 생성 ----------

    @Transactional
    fun create(userId: Long?, request: GamerProfileCreateRequest, httpRequest: HttpServletRequest): GamerProfileCreateResponse {
        val slug = normalizeSlug(request.customSlug)
        if (!isValidSlugFormat(slug)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "주소 ID는 영문 소문자·숫자·-·_ 3~50자만 가능합니다.")
        }
        if (isReserved(slug)) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "사용할 수 없는 주소 ID입니다.")
        }
        if (gamerProfileRepository.existsByCustomSlug(slug)) {
            throw ResponseStatusException(HttpStatus.CONFLICT, "이미 사용 중인 주소 ID입니다.")
        }

        val profile: GamerProfile
        var isGuest = false
        if (userId != null) {
            // 회원: 1인 1프로필
            if (gamerProfileRepository.findByUserId(userId) != null) {
                throw ResponseStatusException(HttpStatus.CONFLICT, "이미 프로필이 있습니다.")
            }
            profile = GamerProfile(customSlug = slug, userId = userId)
        } else {
            isGuest = true
            val guestPassword = request.guestPassword?.trim().takeUnless { it.isNullOrEmpty() }
                ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "암구호(비밀번호)를 입력해 주세요.")
            if (guestPassword.length < 4) {
                throw ResponseStatusException(HttpStatus.BAD_REQUEST, "암구호는 4자 이상이어야 합니다.")
            }
            val clientIp = ClientIpResolver.resolve(httpRequest)
            profile = GamerProfile(
                customSlug = slug,
                userId = null,
                guestPasswordHash = passwordEncoder.encode(guestPassword),
                guestIpHash = if (clientIp == "unknown") null else Sha256Hex.hash(clientIp),
            )
        }

        profile.replaceCards(mapCards(request.cards))
        profile.replaceFeeds(mapFeeds(request.feeds))
        gamerProfileRepository.save(profile)

        val editToken = if (isGuest) editTokenService.issue(slug).token else null
        return GamerProfileCreateResponse(slug = slug, editToken = editToken)
    }

    // ---------- 비회원 암구호 검증 ----------

    @Transactional(readOnly = true)
    fun verifyPassword(rawSlug: String, password: String): GamerProfileVerifyPasswordResponse {
        val profile = loadOrThrow(rawSlug)
        if (!profile.isGuest) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "회원 프로필은 로그인으로 수정합니다.")
        }
        val hash = profile.guestPasswordHash
            ?: throw ResponseStatusException(HttpStatus.FORBIDDEN, "수정할 수 없습니다.")
        if (!passwordEncoder.matches(password.trim(), hash)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "암구호가 일치하지 않습니다.")
        }
        val issued = editTokenService.issue(profile.customSlug)
        return GamerProfileVerifyPasswordResponse(editToken = issued.token, expiresInSeconds = issued.expiresInSeconds)
    }

    // ---------- 수정 ----------

    @Transactional
    fun update(rawSlug: String, userId: Long?, editToken: String?, request: GamerProfileUpdateRequest): GamerProfileResponse {
        val profile = loadOrThrow(rawSlug)
        authorizeEdit(profile, userId, editToken)

        profile.replaceCards(mapCards(request.cards))
        profile.replaceFeeds(mapFeeds(request.feeds))
        return GamerProfileResponse.from(profile, publicBaseUrl)
    }

    /** 회원: user_id 일치 / 비회원: 유효한 X-Profile-Edit-Token. */
    private fun authorizeEdit(profile: GamerProfile, userId: Long?, editToken: String?) {
        if (!profile.isGuest) {
            if (userId == null || userId != profile.userId) {
                throw ResponseStatusException(HttpStatus.FORBIDDEN, "수정 권한이 없습니다.")
            }
            return
        }
        if (!editTokenService.isValid(profile.customSlug, editToken)) {
            throw ResponseStatusException(HttpStatus.FORBIDDEN, "암구호 인증이 필요합니다.")
        }
    }

    // ---------- 내부 매핑 ----------

    private fun mapCards(reqs: List<GamerProfileCardRequest>): List<GamerProfileCard> {
        // 대표 게임(is_main)은 최대 1개만 — 여러 개 요청 시 첫 카드만 채택.
        var mainAssigned = false
        return reqs.mapIndexed { idx, r ->
            val main = if (r.isMain && !mainAssigned) {
                mainAssigned = true
                true
            } else {
                false
            }
            GamerProfileCard(
                gameSlug = r.gameSlug.trim().lowercase(),
                gameSource = r.gameSource,
                gameTitle = r.gameTitle.trim(),
                gameIconUrl = r.gameIconUrl?.trim().orEmptyToNull(),
                externalApiIdentifier = r.externalApiIdentifier?.trim().orEmptyToNull(),
                isMain = main,
                displayOrder = idx,
            ).apply {
                replaceStats(
                    r.stats.mapIndexed { sIdx, s ->
                        GamerProfileCardStat(
                            statKey = s.statKey.trim(),
                            statValue = s.statValue.trim(),
                            displayOrder = sIdx,
                        )
                    },
                )
            }
        }
    }

    private fun mapFeeds(reqs: List<GamerProfileFeedRequest>): List<GamerProfileFeed> =
        reqs.mapIndexed { idx, r ->
            GamerProfileFeed(
                imageUrl = r.imageUrl.trim(),
                description = r.description?.trim().orEmptyToNull(),
                feedType = r.feedType,
                displayOrder = idx,
            )
        }

    private fun loadOrThrow(rawSlug: String): GamerProfile =
        gamerProfileRepository.findByCustomSlug(normalizeSlug(rawSlug))
            ?: throw ResponseStatusException(HttpStatus.NOT_FOUND, "프로필을 찾을 수 없습니다.")

    private fun normalizeSlug(raw: String): String = raw.trim().lowercase()

    private fun isValidSlugFormat(slug: String): Boolean = SLUG_REGEX.matches(slug)

    private fun isReserved(slug: String): Boolean = slug in RESERVED_SLUGS

    private fun String?.orEmptyToNull(): String? = this?.takeUnless { it.isEmpty() }

    companion object {
        private val SLUG_REGEX = Regex("^[a-z0-9][a-z0-9_-]{2,49}$")

        /** 프론트 라우트(/profile/create, /profile/my 등)와 충돌하는 슬러그 차단. */
        private val RESERVED_SLUGS = setOf("create", "my", "new", "edit", "api", "en", "profile", "admin", "null", "undefined")
    }
}

