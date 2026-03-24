package com.pickty.server.global.oauth2

import com.pickty.server.domain.user.AccountStatus
import com.pickty.server.domain.user.UserRepository
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.server.ResponseStatusException
import org.springframework.web.servlet.view.RedirectView

@Controller
class OAuth2LinkStartController(
    private val oauthLinkService: OAuthLinkService,
    private val userRepository: UserRepository,
) {

    @GetMapping("/oauth2/link/start")
    fun start(
        @RequestParam("t") token: String,
        @RequestParam("registrationId") registrationId: String,
        response: HttpServletResponse,
    ): RedirectView {
        val rid = registrationId.lowercase().trim()
        if (rid !in ALLOWED_REGISTRATION_IDS) {
            throw ResponseStatusException(HttpStatus.BAD_REQUEST, "지원하지 않는 OAuth 제공자입니다.")
        }
        val userId = oauthLinkService.consumeChallenge(token)
            ?: throw ResponseStatusException(HttpStatus.BAD_REQUEST, "잘못되었거나 만료된 연동 요청입니다.")

        val user = userRepository.findById(userId)
            .orElseThrow { ResponseStatusException(HttpStatus.BAD_REQUEST, "유효하지 않은 연동 요청입니다.") }

        if (user.accountStatus != AccountStatus.ACTIVE) {
            throw ResponseStatusException(
                HttpStatus.CONFLICT,
                "온보딩을 완료한 활성 계정만 소셜 연동을 진행할 수 있습니다.",
            )
        }

        val cookieValue = "$userId|$rid"
        CookieUtils.addCookie(
            response,
            OAuthLinkConstants.OAUTH_LINK_COOKIE,
            cookieValue,
            OAuthLinkConstants.LINK_COOKIE_MAX_AGE_SECONDS,
        )

        return RedirectView("/oauth2/authorization/$rid")
    }

    companion object {
        private val ALLOWED_REGISTRATION_IDS = setOf("google", "kakao")
    }
}
