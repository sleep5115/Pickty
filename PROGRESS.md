# Pickty 진행 현황

> 웹 AI(Gemini)에게 컨텍스트를 전달하기 위한 파일.
> 작업할 때마다 Cursor AI가 이 파일을 업데이트한다.

---

## 레포 구조 (모노레포)

- **레포**: https://github.com/sleep5115/Pickty (단일 모노레포)
- `frontend/` — Frontend (Next.js App Router)
- `backend/` — Backend (Kotlin, Spring Boot)
- `docker-compose.yml` — PostgreSQL 17 + Valkey 9 로컬 환경
- `PROGRESS.md` — 이 파일 (루트 단일 파일로 관리)

### 브랜치 전략
| 브랜치 | 용도 |
|---|---|
| `main` | 배포용 — 직접 push 금지, `dev` PR로만 머지. 머지 시 자동 배포 예정 |
| `dev` | 기본 브랜치 — 평소 개발 작업 |

---

## 전체 진행 상태

| 영역 | 상태 | 비고 |
|---|---|---|
| 개발 환경 세팅 | ✅ 완료 | |
| 모노레포 전환 | ✅ 완료 | frontend/ + backend/ 폴더 구조, 브랜치 전략 확정 |
| Frontend 기초 | ✅ 완료 | |
| Backend 기초 | ✅ 완료 | |
| Auth — 엔티티/도메인 설계 | ✅ 완료 | User, SocialAccount 엔티티 완성 |
| Auth — 로그인/회원가입 UI | ✅ 완료 | 소셜 로그인 팝업 흐름 포함 |
| Auth — Backend OAuth2 구현 | ✅ 완료 | SecurityConfig, JWT, OAuth2 핸들러 완성 |
| Auth — Frontend ↔ Backend 연동 | 🔧 진행중 | Google OAuth2 크레덴셜 적용 완료, 실제 통신 테스트 필요 |
| Tier Maker | ⬜ 미시작 | |
| Ideal Type World Cup | ⬜ 미시작 | |

---

## 완료된 작업

### 개발 환경
- Docker Compose로 PostgreSQL 17 + Valkey 9 로컬 구동 (`CursorProjects/docker-compose.yml`)
- DB 접속 정보는 `application-local.yaml`로 분리 후 gitignore 처리
- **로컬 DB 접속 정보**: `localhost:5432` / DB: `pickty` (접속 정보는 `application-local.yaml` 참고)
- Google OAuth2 client-id / client-secret 발급 및 `application-local.yaml`에 적용 완료 (gitignore됨)
- 모노레포(Pickty) 전환 완료: 기존 side_project_1, side_project_2 분리 레포 → 단일 레포 통합

### Frontend (`frontend/`)
- Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript 기본 세팅 완료
- `next-themes` + `zustand` 설치
- 다크/라이트 모드 토글 구현 (`ThemeProvider`, `ThemeToggle` 컴포넌트)
- **페이지 목록**
  - `/` — 메인 랜딩 (티어/월드컵 진입 버튼)
  - `/tier` — 더미 티어 대시보드
  - `/worldcup` — 더미 월드컵 대시보드
  - `/login` — 로그인 페이지 (이메일/비밀번호 + 소셜 로그인 팝업 흐름)
  - `/signup` — 회원가입 페이지 (이메일/닉네임/비밀번호)
  - `/auth/callback` — OAuth2 팝업 콜백 (postMessage 후 window.close())
- **폼 검증**: `react-hook-form` + `zod` (`src/lib/schemas/auth.ts`)
- **소셜 로그인 팝업 흐름 구현 완료** (UI + 팝업 통신 로직, 백엔드 실제 연동은 테스트 필요)
  - 주요: Google, 네이버, 카카오 (와이드 버튼)
  - 방송: Twitch, 치지직, SOOP (원형 버튼)
  - `window.open()` 팝업 → 팝업 차단 시 현재 탭 리다이렉트 fallback
  - 팝업 완료 후 `postMessage`로 부모 창에 토큰 전달
  - 소셜 로그인 실패 시 에러 배너 표시
- **Zustand auth store** (`src/lib/store/auth-store.ts`) — JWT 토큰 상태 관리

### Backend (`backend/`)
- Spring Boot 4.0.3 + Kotlin 2.2.21 기본 세팅 완료
- JVM 타겟: JDK 25 toolchain + 컴파일 타겟 JVM 24
- 서버 기동 확인 (`localhost:8080`)
- **패키지**: `com.pickty.server`
- **엔티티**: User, SocialAccount, Provider(Enum), Role(Enum), BaseTimeEntity
- **Repository**: UserRepository, SocialAccountRepository
- **SecurityConfig** — Guest First 방식
  - `/api/v1/user/**` 만 인증 필요, 나머지 전체 permitAll
  - Stateless 세션 (JWT 방식)
  - OAuth2 로그인 설정 (authorizationEndpoint, userInfoEndpoint, successHandler)
- **CustomOAuth2UserService** — OAuth2 로그인 시 User/SocialAccount upsert
- **OAuth2SuccessHandler** — 로그인 성공 시 JWT 발급 → `/auth/callback?token={JWT}` 리다이렉트
- **JwtTokenProvider** — JWT 생성/파싱/검증
- **JwtAuthenticationFilter** — 요청마다 JWT 추출 및 SecurityContext 설정
- **JwtProperties** — `jwt.secret` 설정값 바인딩
- **RefreshTokenService** — Valkey(Redis)에 Refresh Token 저장/조회/삭제
- **HttpCookieOAuth2AuthorizationRequestRepository** — OAuth2 state를 쿠키로 관리
- **CookieUtils** — 쿠키 생성/읽기/삭제 유틸
- **UnauthorizedEntryPoint** — 미인증 요청 시 401 JSON 응답

---

## 소셜 로그인 팝업 흐름

```
[login/page.tsx] 버튼 클릭
  → window.open("http://localhost:8080/oauth2/authorization/{provider}", 500×620 팝업)
    → Spring Security OAuth2 처리
      → CustomOAuth2UserService: User/SocialAccount upsert
        → OAuth2SuccessHandler: JWT 발급
          → 성공: 팝업을 /auth/callback?token={JWT} 로 리다이렉트
            → [auth/callback/page.tsx] postMessage({ type:'OAUTH_SUCCESS', token }) → window.close()
              → [login/page.tsx] 토큰 수신 → Zustand store 저장 → router.push('/')
          → 실패: 팝업을 /auth/callback?error=... 로 리다이렉트
            → postMessage({ type:'OAUTH_ERROR' }) → window.close()
              → [login/page.tsx] 에러 배너 표시
  ※ 팝업 차단 시: 현재 탭에서 직접 리다이렉트 fallback
```

---

## 핵심 코드 구조

### Frontend (`frontend/src/`)
```
app/
├── layout.tsx                  # ThemeProvider, suppressHydrationWarning
├── globals.css                 # Tailwind v4, CSS 변수
├── page.tsx                    # 메인 랜딩
├── login/page.tsx              # 로그인 (react-hook-form + zod + OAuth2 팝업)
├── signup/page.tsx             # 회원가입
├── auth/callback/page.tsx      # OAuth2 팝업 콜백
├── tier/page.tsx               # 더미 티어 대시보드
└── worldcup/page.tsx           # 더미 월드컵 대시보드
components/
├── ThemeToggle.tsx
└── providers/ThemeProvider.tsx
lib/
├── schemas/auth.ts             # zod 스키마
└── store/auth-store.ts         # Zustand JWT 상태 관리
```

### Backend (`backend/src/main/kotlin/com/pickty/server/`)
```
ServerApplication.kt
domain/
├── auth/
│   ├── PrincipalDetails.kt                         # OAuth2/UserDetails 어댑터
│   ├── dto/OAuth2UserInfo.kt                        # provider별 사용자 정보 추출
│   ├── handler/OAuth2SuccessHandler.kt             # 로그인 성공 → JWT 발급 → 리다이렉트
│   └── service/
│       ├── CustomOAuth2UserService.kt              # User/SocialAccount upsert
│       └── RefreshTokenService.kt                  # Valkey Refresh Token CRUD
└── user/
    ├── User.kt / SocialAccount.kt / Provider.kt / Role.kt
    ├── UserRepository.kt / SocialAccountRepository.kt
global/
├── common/BaseTimeEntity.kt
├── config/
│   ├── JpaAuditingConfig.kt
│   ├── JwtConfig.kt
│   └── SecurityConfig.kt                           # Guest First, Stateless
├── jwt/
│   ├── JwtTokenProvider.kt
│   ├── JwtAuthenticationFilter.kt
│   └── JwtProperties.kt
├── oauth2/
│   ├── CookieUtils.kt
│   └── HttpCookieOAuth2AuthorizationRequestRepository.kt
└── security/UnauthorizedEntryPoint.kt
```

---

## 로컬 세팅 가이드

### 새 PC 최초 세팅 (전체 순서)
```bash
# 1. 코드 클론 + git config
git clone https://github.com/sleep5115/Pickty.git
cd Pickty
git config user.name "sleep5115"
git config user.email "85235927+sleep5115@users.noreply.github.com"

# 2. 로컬 설정 파일 복사 (실제 값은 pickty-config 레포에 있음)
git clone https://github.com/sleep5115/pickty-config.git
copy pickty-config\application-local.yaml backend\src\main\resources\application-local.yaml
rmdir /s /q pickty-config
# 집 PC라면 포트 그대로, 회사 PC라면 postgresql 5442 / redis 6380 으로 수정

# 3. Docker 기동
docker compose up -d
```

### application-local.yaml 관리
- 실제 값은 **https://github.com/sleep5115/pickty-config** (private 레포) 에서 관리
- 변경 시: pickty-config 레포의 파일 수정 후 push → 다음 PC에서 pull

### application-local.yaml 구조 참고 (플레이스홀더)

**집 PC** (`backend/src/main/resources/application-local.yaml`):
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/pickty
    username: <db-username>
    password: <db-password>
  data:
    redis:
      host: localhost
      port: 6379
      password:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: <google-client-id>
            client-secret: <google-client-secret>

jwt:
  secret: <jwt-secret-32chars-이상>
```

**회사 PC** (`backend/src/main/resources/application-local.yaml`):
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5442/pickty
    username: <db-username>
    password: <db-password>
  data:
    redis:
      host: localhost
      port: 6380
      password:
  security:
    oauth2:
      client:
        registration:
          google:
            client-id: <google-client-id>
            client-secret: <google-client-secret>

jwt:
  secret: <jwt-secret-32chars-이상>
```

---

## 다음 작업 예정

- [ ] Google OAuth2 실제 로그인 흐름 E2E 테스트 (프론트 팝업 → 백엔드 → JWT 수신 확인)
- [ ] Frontend: JWT 수신 후 Zustand store 저장 → 인증 상태 기반 UI 분기 (로그인/로그아웃 버튼)
- [ ] Backend: Refresh Token 재발급 API (`POST /auth/refresh`)
- [ ] Backend: 로그아웃 API (`POST /auth/logout`) — Refresh Token 삭제
- [ ] Backend: 자체 회원가입/로그인 API (`POST /auth/signup`, `POST /auth/login`)
- [ ] Frontend: 자체 로그인/회원가입 폼 → 백엔드 API 연동
- [ ] 네이버 / 카카오 OAuth2 앱 등록 및 크레덴셜 발급
