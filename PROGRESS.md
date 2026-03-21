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

## Phase 4 — 운영 인프라 (목표)

| 구분 | 계획 |
|------|------|
| 백엔드·DB 호스팅 | **Hetzner** 가성비 서버에서 Spring Boot + **PostgreSQL** + **Valkey** 운영 |
| 이미지 스토리지 | **Cloudflare R2** (AWS S3 API 호환, Egress 무료) |
| 프론트엔드 배포 | **Vercel** 또는 별도 컨테이너 |

### UX 라우팅 흐름 (개편)

- **기존**: 메인 → `/tier` (바로 보드 진입)
- **변경**: 메인 → **`/templates`** (템플릿 목록) → 카드 선택 시 **`/tier?templateId={id}`** · 새 밀키트는 **`/template/new`**

---

## 전체 진행 상태

| 영역 | 상태 | 비고 |
|---|---|---|
| 개발 환경 세팅 | ✅ 완료 | |
| 모노레포 전환 | ✅ 완료 | frontend/ + backend/ 폴더 구조, 브랜치 전략 확정 |
| 로컬 설정 관리 | ✅ 완료 | pickty-config private 레포로 PC 간 공유 |
| GNB / 글로벌 레이아웃 | ✅ 완료 | max-w-6xl, 햄버거(모바일), 테마 토글, 로그인/로그아웃, AdBanner 자리 |
| Frontend 기초 | ✅ 완료 | Next 16, React 19, Tailwind v4 |
| Backend 기초 | ✅ 완료 | Spring Boot 4, Kotlin 2.2, JWT, OAuth2 |
| Auth — 엔티티/도메인·OAuth2·연동 | ✅ 완료 | Google E2E, JWT, 대시보드 `/api/v1/user/me`, LAN·환경변수 URL 대응(CORS·동적 리다이렉트·쿠키 오리진) |
| Tier Maker (프론트 1차) | ✅ 완료 | DnD·행정렬·설정모달·멀티선택·보내기(PC폭 캡처)·라이트/다크·모바일 안정화 |
| Tier Maker (미구현) | ⬜ 예정 | **R2** 정식 스토리지·리사이즈, 스트리머 방 TTL, 임시→계정 **마이그레이션** (로컬 `pickty_uploads` 임시 업로드는 구현됨) |
| Ideal Type World Cup | ⬜ 미시작 | |

### 진행 스냅샷 (2026-03 후반)

- **템플릿 허브**: `/templates` — `GET /api/v1/templates`로 **DB 템플릿 목록** 표시(최신순)·하단 예시 데모 카드 유지·**새 템플릿 만들기** → `/template/new`.
- **이미지 저장(현재)**: 파일 업로드는 임시로 백엔드를 통해 **호스트 PC 바탕화면** `pickty_uploads`에 저장되며, **`/uploads/**`** 로 정적 서빙(`http://localhost:8080/uploads/…`). DB `items` JSON에는 해당 **http(s) URL**이 기록됨. (추후 **Cloudflare R2** 연동 시 업로드·서빙 서비스 레이어만 교체 예정)
- **템플릿 작성(밀키트)**: `/template/new` — 제출 시 **`POST /api/v1/images`**(FormData·다건) → 반환 URL을 `imageUrl`에 매핑 후 **`POST /api/v1/templates`**. 미리보기는 로컬 blob 유지. 저장 완료 패널·내 정보 안내 동일.
- **티어 메이커**: `?templateId=` 쿼리 시 `GET /api/v1/templates/{id}`로 풀 복원(`loadTemplateWorkspace`). PC/모바일 UX·하이드레이션·LAN 등 기존 플로우 유지.
- **내 티어표**: GNB **내 정보 ▾** → `/tier/my` · API `GET /api/v1/tiers/results/mine`(JWT).
- **알려진 개발 콘솔**: `next-themes` 인라인 script 관련 React 19 경고는 라이브러리 한계(동작은 Recoverable 수준).
- **이미지 업로드 413**: (1) Tomcat `maxPostSize` — `application.yaml`의 `server.tomcat.*` + **`TomcatMaxPostSizeCustomizer`**(Boot 4는 `org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory`). (2) **일부 프록시는 요청당 본문 제한**이 있어 한 번에 여러 파일 POST 시 413이 남 → 프론트는 **`uploadPicktyImages`에서 파일마다 순차 `POST /api/v1/images`**(본문 1개씩). 단일 파일도 너무 크면 여전히 413 가능.

### 세션 메모 (2026-03-21)

- **로컬 개발 전제**: ngrok 전용 코드 제거. `frontend/.env.local`의 `NEXT_PUBLIC_API_URL`은 **로컬 백엔드**(예: `http://localhost:8080`)로 맞출 것 — 옛 ngrok URL이 남으면 API·이미지 요청이 터널로 가며 실패함.
- **옛 업로드 URL 리베이스**: DB JSON에 저장된 `https://(예전호스트)/uploads/…` 는 **`resolvePicktyUploadsUrl`** 등으로 현재 `NEXT_PUBLIC_API_URL` 오리진에 맞춤 (`pickty-image-url.ts`, `tier-api`, `tier-snapshot`, 썸네일·타일 `src`).
- **CORS**: `SecurityConfig`에서 `/uploads/**` 별도 CORS(`allowedOriginPatterns("*")`, `allowCredentials=false`) + API용 `/**`는 기존 origins·`http://localhost:*` 패턴. `WebMvcConfig`의 `addCorsMappings`는 제거(실질 처리는 Security).
- **`<img crossOrigin>`**: Pickty `/uploads/` URL에만 적용 — 외부 이미지 엑박 방지.
- **`/tier/result/[id]`**: `TierBoardReadonly` 캡처 ref는 **티어 행만** (미분류 풀은 화면에만 표시, PNG와 메이커 `ExportModal` 동일).
- **프론트 dev 스크립트**: `"dev": "node ./node_modules/next/dist/bin/next dev -p 3002"` — Windows에서 `npm.cmd` 배치 중단 시 `Y/N` 프롬프트 완화.

### 용어·제품 정의 (혼동 방지)

| 용어 | 제품에서의 의미 | DB/코드 |
|------|-----------------|---------|
| **템플릿** | 티어표를 만들 **재료(밀키트)** — 아이템·이미지·이름이 정해진 묶음. 사용자는 티어에 올리기만 함 | `TierTemplate` (`items` JSONB 등) |
| **티어 결과** | 그 재료로 만든 **개인 배치 스냅샷** (저장·공유 링크) | `TierResult` (`snapshotData` + `templateId`) |

- **현재 구현과의 갭**: 저장 시 `templateId`가 없으면 보드 아이템으로 **`POST /api/v1/templates`가 자동 호출**되어 `tier_templates`에 한 줄이 생김. **전용 템플릿 작성 UI**는 `/template/new`로 제공됨(이미지는 바탕화면 `pickty_uploads` 임시 업로드·R2 전 단계).
- **내 저장 티어표**: **`GET /api/v1/tiers/results/mine`** + **`/tier/my`** 목록 · GNB **내 정보** 드롭다운에서 진입. 단건 보기는 **`/tier/result/[id]`** 유지.

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
  - `/` — 메인 랜딩 (티어/월드컵 진입 버튼 → 티어는 `/templates`로)
  - `/templates` — 티어 **템플릿 목록**(`listTemplates` → `GET /api/v1/templates`) + 하단 예시 데모 · `/template/new` · `/tier?templateId=`
  - `/tier` — 티어 메이커 보드 (DnD, 행 설정, 보내기, 테마, 모바일 대응, `?templateId=`로 서버 템플릿 풀 로드)
  - `/tier/my` — 로그인 유저 **저장 티어표 목록** → `/tier/result/[id]` 링크
  - `/tier/result/[id]` — 저장된 **티어 결과** 단건 읽기 전용 보기 (공유 링크 진입)
  - `/template/new` — 템플릿(밀키트) 작성: `POST /api/v1/images` 후 `POST /api/v1/templates` · `lib/image-upload-api.ts`
  - *(미구현)* **내가 저장한 티어표 목록** 경로
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
              → [login/page.tsx] 토큰 수신 → Zustand store 저장 → router.push('/dashboard')
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
├── layout.tsx                  # GNB, ThemeProvider, main max-w-6xl
├── globals.css                 # Tailwind v4, scrollbar-gutter: stable
├── page.tsx                    # 메인 랜딩
├── login/page.tsx              # 로그인 (테마 대응, OAuth2)
├── signup/page.tsx             # 회원가입
├── auth/callback/page.tsx      # OAuth2 콜백 (팝업 postMessage + 모바일 직접 리다이렉트)
├── dashboard/page.tsx          # 내 계정 (apiFetch, 401 시 로그아웃)
├── tier/page.tsx               # 티어 메이커 (deviceReady / 포인터 모드 안내)
└── worldcup/page.tsx           # 월드컵 자리
components/
├── layout/gnb.tsx              # GNB, 모바일 햄버거
├── ThemeToggle.tsx
├── providers/ThemeProvider.tsx
├── common/ad-banner.tsx
└── tier/
    ├── item-card.tsx
    ├── tier-row.tsx            # ⚙ ≡, Sortable 행
    ├── tier-settings-modal.tsx
    ├── item-pool.tsx
    ├── tier-board.tsx          # DnD, drag-select, ExportModal
    └── export-modal.tsx        # html-to-image, 오프스크린 클론 캡처
lib/
├── api-fetch.ts                # NEXT_PUBLIC_API_URL 기준 fetch
├── schemas/auth.ts
├── store/auth-store.ts
└── store/tier-store.ts
hooks/
├── use-pointer-device.ts
└── use-drag-select.ts
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
    ├── UserController.kt                               # GET /api/v1/user/me, GET /api/v1/user/me/oauth-raw
    ├── UserService.kt                                  # getMe, getOAuthRaw (Valkey 30분 캐시)
    └── UserResponse.kt                                 # DTO
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

## 개발 진행 방향 (로드맵)

MVP 우선 원칙 — "동작하는 핵심 기능"을 먼저, 완성도는 나중에 올린다.

### Phase 1 — 뼈대
> 목표: 앱을 돌아다닐 수 있는 최소한의 구조 완성 → **대부분 완료**

- [x] 구글 OAuth2 로그인 E2E
- [x] **글로벌 레이아웃 / GNB** — 로고, 메뉴, 모바일 햄버거, 로그인 상태
- [x] **프론트 로그아웃** — Zustand 토큰 삭제 (백엔드 Valkey Refresh 무효화는 추후)
- [x] `/templates`·`/tier`·`/worldcup` 진입 경로 (랜딩·GNB — 티어 허브는 `/templates`)

> ⚠️ 백엔드 완벽한 로그아웃(Refresh Token 삭제), 자체 회원가입/로그인, 네이버/카카오는  
> 핵심 서비스 개발 후 Auth 고도화 단계에서 한꺼번에 처리

### Phase 2 — 핵심 서비스 기획
> 목표: 코드 치기 전에 "무엇을 만들지" 확정

- [x] **Tier Maker 화면 (프론트 프로토타입)** — 인터랙션·보내기까지 구현됨, **저장 API·이미지 스펙**은 미정
- [ ] **Tier Maker 백엔드 스펙 확정** — 템플릿/결과 저장 API, 이미지 스토리지
- [ ] **Ideal Type World Cup 화면 기획** — 유저 흐름, 토너먼트 진행 방식, 실시간 여부
- [ ] 스트리머 모드 범위 결정 (1차 MVP에 포함할지 여부)

> 기획이 확정돼야 프론트 컴포넌트 구조와 백엔드 API 설계를 헤매지 않고 진행 가능

### Phase 3 — 핵심 서비스 구현
> 목표: 실제로 동작하는 Tier Maker / World Cup

- [ ] 백엔드 API 설계 및 구현 (템플릿, 항목, 결과 저장 등)
- [ ] 프론트엔드 서비스 화면 구현
- [ ] 이미지 업로드 (S3 or 외부 스토리지 연동)
- [ ] 스트리머 모드 (실시간 집계, Valkey pub/sub 또는 WebSocket)

### Phase 4 — Auth 고도화 & 운영 준비
> 목표: 서비스가 동작한 후 완성도 올리기

- [ ] 네이버 / 카카오 OAuth2 추가
- [ ] 자체 회원가입 / 로그인
- [ ] Refresh Token 재발급 / 완전한 로그아웃
- [ ] 배포 환경 구성 (Vercel + Docker)

---

## 다음 작업 예정

### Tier Maker — 다음 스프린트 (우선순위 제안)

1. **템플릿 작성 화면** — 제품 정의상 “밀키트” 등록(아이템 이미지·이름·템플릿 메타) 전용 플로우. 저장 시 자동 생성 템플릿과 **역할 분리**되어 용어 혼동 완화.
2. **내가 저장한 티어표** — GNB/대시보드 등 **진입 경로** + 목록 UI + 백엔드 `GET`(예: 로그인 사용자의 `TierResult` 페이지네이션). 현재는 `/tier/result/[id]` 직접 링크만 존재.
3. **이미지 업로드**: 아이템 썸네일, 스토리지(R2 등) 연동

※ **결과 저장**(로그인 시 `createTemplate` + `createTierResult`, 읽기 `GET /api/v1/tiers/results/{id}`)은 9차 인프라로 **1차 완료**됨.

---

### Tier Maker — 완료된 기능 (누적)

#### 완료된 기능
- [x] Zustand Store 설계 (`tier-store.ts`) — tiers, pool, selectedItemIds, targetTierId
- [x] `usePointerDevice` 훅 — `window.matchMedia('pointer: fine')` 감지
- [x] UI 뼈대: TierBoard, TierRow, ItemCard, ItemPool
- [x] **타겟팅 모드 (Click-to-Move)** — PC/모바일 공용
  - 티어 라벨 클릭 → 활성화 / 재클릭 또는 ESC → 해제
  - 활성화 중 아이템 클릭 → 해당 티어로 즉시 이동
  - 아이템 사이 틈 클릭으로는 해제되지 않음 (광클 오작동 방지)
  - 타겟팅 토스트 배너 — 절대 위치 오버레이 (레이아웃 밀림 없음)
- [x] **dnd-kit 단일/멀티 드래그 앤 드랍** — PC 기본 모드
  - `PointerSensor` (8px 임계값) — 클릭과 드래그 충돌 없음
  - 드랍 존 hover 시 시각적 하이라이트
  - `DragOverlay` — 커서를 따라다니는 아이템 미리보기
  - 멀티드래그: 선택된 아이템 중 하나를 드래그하면 전체 일괄 이동, 배지로 개수 표시
- [x] **범위 선택 (Drag Select)** — PC 전용 (`use-drag-select.ts`)
  - 빈 공간 드래그로 보라색 선택 박스 표시 → 범위 내 아이템 일괄 선택
  - 타겟팅 모드 / 드래그 중일 때는 자동 비활성화
- [x] **Ctrl+클릭 개별 추가 선택** — PC 전용 (Mac: Cmd+클릭)
  - 범위 선택 후 Ctrl+클릭으로 개별 아이템 추가/제거 가능

#### 완료된 기능 (2차)
- [x] **티어 행 DnD 정렬** — `useSortable` + 드래그 핸들(6점 아이콘)로 행 순서 변경
  - `SortableContext(verticalListSortingStrategy)`를 `tier-board.tsx`에 적용
  - `tier-row.tsx`에서 `useDroppable` → `useSortable` 교체, handleListeners를 핸들 버튼에만 연결
  - `active.data.current.type === 'tier-row'` 분기로 아이템 드래그와 충돌 없이 분리
  - 행 정렬 중(`isRowSortActive`)에는 아이템 드롭 하이라이트 억제
- [x] **티어 설정 모달** (`TierSettingsModal`) — 각 행 우측 ⚙️ 버튼 클릭 시 오픈
  - 15종 색상 프리셋 팔레트 + 커스텀 컬러 피커
  - 라벨 텍스트 수정 Input (Enter로 적용)
  - 입력 제한: 한글/CJK 포함 시 최대 3자, 영어·숫자만이면 최대 5자
  - 4개 액션: 위에 행 추가 / 아래에 행 추가 / 행 비우기(아이템 미분류로) / 행 삭제
  - ⚙️ 버튼이 핸들(≡) 왼쪽에 위치, 핸들은 맨 우측
- [x] **Store 액션 5개 추가** (`tier-store.ts`)
  - `reorderTiers(activeId, overId)` — arrayMove 기반 행 순서 변경
  - `updateTier(tierId, updates)` — label / color 변경
  - `addTierRow(nearTierId, position)` — 행 위/아래에 빈 행 삽입
  - `deleteTierRow(tierId)` — 행 삭제 + 아이템 Pool 반환
  - `clearTierRow(tierId)` — 행 유지, 아이템만 Pool 반환
- [x] **@dnd-kit/sortable** 패키지 설치

#### 완료된 기능 (7차 — 모바일 지원 & 인증 안정화)
- [x] **터치 드래그 수정** (`item-card.tsx`)
  - `touch-none` 클래스 추가 → 터치 시 브라우저 스크롤 낚아채기 방지, dnd-kit에 정상 전달
- [x] **모바일 GNB 햄버거 메뉴** (`gnb.tsx`)
  - `md` 미만: 중앙 네비 숨기고 햄버거 버튼 표시 (3선 → X 애니메이션)
  - 드롭다운: 티어메이커 / 이상형월드컵 / 내계정 / 로그인·로그아웃
  - 외부 클릭 또는 페이지 이동 시 자동 닫힘
- [x] **대시보드 중복 레이아웃 제거** (`dashboard/page.tsx`)
  - 자체 `<header>` (Pickty 로고 + 로그아웃 버튼) 삭제 → GNB로 통합
  - 하드코딩된 `min-h-screen bg-zinc-950` 제거, 다크/라이트 테마 대응
- [x] **스테일 토큰 자동 로그아웃** (`dashboard/page.tsx`)
  - API 401 응답 시 `clearAuth()` + `/login` 자동 리다이렉트
- [x] **모바일 OAuth2 리다이렉트 fallback** (`auth/callback/page.tsx`)
  - `window.opener` 없을 때 (모바일 팝업 차단) 토큰 저장 후 홈으로 이동
- [x] **환경변수 기반 URL 처리** (모바일·LAN 테스트 시 API URL 분리)
  - `frontend/.env.local` 생성: `NEXT_PUBLIC_API_URL`
  - `backend/SecurityConfig.kt`: `app.frontend-url` 주입으로 CORS 하드코딩 제거
  - `backend/application.yaml`: `app.oauth2.allowed-frontend-origins` 추가
- [x] **OAuth2 동적 리다이렉트** (데스크톱 + 모바일 동시 동작)
  - `HttpCookieOAuth2AuthorizationRequestRepository`: 로그인 시작 시 `Origin` 헤더를 `oauth2_frontend_origin` 쿠키에 저장
  - `OAuth2SuccessHandler`: 쿠키에서 오리진 읽어 화이트리스트 검증 후 동적 리다이렉트, 미등록 오리진은 `frontendUrl` 폴백

#### 완료된 기능 (6차 — UX 버그 수정 & 레이아웃 안정화)
- [x] **범위 선택(Drag Select) 동작 안정화**
  - drag-select 완료 직후 `click` 이벤트가 `boardRef`까지 버블링되어 `clearSelection()`이 즉시 실행되던 버그 수정
  - `justDragSelectedRef` 추가: drag-select 완료 후 50ms 이내 click 이벤트는 `handleClickEmpty` skip
  - drag-select를 새로 시작하면 기존 선택이 초기화되고 새 범위만 선택 (Windows 표준 동작)
  - 기존 Ctrl+클릭 누적 선택 동작은 그대로 유지
- [x] **스크롤바 Layout Shift 방지** (`globals.css`)
  - `html { scrollbar-gutter: stable; }` 추가
  - 스크롤바 생성/소멸 시 전체 컴포넌트가 좌우로 흔들리던 현상 해결

#### 완료된 기능 (5차 — 티어 메이커 라이트/다크 테마 대응)
- [x] **티어 메이커 전체 테마 적용** — 하드코딩된 dark color를 `light dark:dark` 쌍으로 교체
  - `tier/page.tsx`: `bg-white dark:bg-zinc-900`, 툴바·푸터 배경·텍스트·보더 테마화
  - `tier-board.tsx`: 캡처 영역 `bg-white dark:bg-zinc-900`, 저장 버튼 바 테마화
  - `tier-row.tsx`: 행 보더·아이템 영역 배경·사이드 버튼(설정/핸들) 테마화
  - `item-card.tsx`: 선택 링 오프셋 `ring-offset-white dark:ring-offset-zinc-900`, 비활성 보더 테마화
  - `item-pool.tsx`: 배경·보더·텍스트 테마화 (hover 하이라이트 포함)
  - `tier-settings-modal.tsx`: 패널·인풋·버튼·액션(amber/red hover) 모두 테마화
  - `export-modal.tsx`: 패널·버튼·텍스트·스피너·미리보기 이미지 보더 테마화

#### 완료된 기능 (4차 — 레이아웃 / GNB)
- [x] **GNB** (`components/layout/gnb.tsx`) — 전체 너비 배경, 내부 콘텐츠 max-w-6xl
  - 좌: Pickty 로고 / 중: 티어 메이커·이상형 월드컵 링크 (현재 경로 active 스타일) / 우: 테마 토글·로그인·로그아웃
  - 로그아웃 클릭 시 `logout()` + 홈 리다이렉트
- [x] **글로벌 레이아웃** (`layout.tsx`) — `h-screen flex flex-col` 래퍼, GNB 추가
  - `<main>` = `flex-1 min-h-0 flex flex-col max-w-6xl mx-auto w-full px-4`
  - 높이 체인 안정성: `h-screen` → `min-h-0` → `overflow-hidden` 조합으로 TierBoard `h-full` 정상 동작
- [x] **AdBanner** (`components/common/ad-banner.tsx`) — 높이(height prop) 조절 가능한 광고 자리 컴포넌트
- [x] **tier/page.tsx** 레이아웃 업데이트
  - `h-screen` 제거 → `flex-1 min-h-0 overflow-hidden` (글로벌 레이아웃과 높이 공유)
  - Pickty 로고 제거 (GNB로 이전), 툴바 간소화
  - 티어 보드 위에 `AdBanner` (h=90) 배치
- [x] **auth-store.ts** — `logout` 액션 추가

#### 완료된 기능 (3차)
- [x] **내보내기 모달** (`ExportModal`) — 보드 하단 "저장 | 다운로드" 버튼 클릭 시 오픈
  - `html-to-image`의 `toPng`로 티어 행 영역만 캡처 (Item Pool 제외, scrollHeight 전체)
  - **PreviewView**: 이미지 미리보기 + 다운로드 버튼 + 재생성 링크 + 로그인 유도
  - **DownloadedView**: 다운로드 완료 후 회원가입 유도 뷰로 자동 전환
    - 성공 메시지(🎉) + 혜택 체크리스트 4개
    - "Create an Account" → `/signup` 링크 / "No Thanks" → 모달 닫기
    - 모달 닫을 때 `isDownloaded` 항상 초기화 (재오픈 시 미리보기 뷰부터 시작)
  - 보드 하단 버튼: 💾(플로피디스크) + 저장 | 다운로드 + ↓⬜(다운로드박스) 아이콘
- [x] **캡처 영역 분리** — `captureRef`를 SortableContext 래퍼 div에 지정 (`bg-zinc-900`)

#### 완료된 기능 (7차 — 모바일 UX 버그 수정)
- [x] **모바일 GNB 햄버거 수정** (`gnb.tsx`)
  - `w-4.5` (무효 클래스) → `w-4`로 수정
  - `mousedown` → `pointerdown`으로 외부 클릭 감지 이벤트 교체 (터치 대응)
  - `type="button"` 추가
- [x] **ThemeToggle 초기 렌더** (`ThemeToggle.tsx`)
  - 마운트 전 빈 div → 스켈레톤 div 렌더 (icon 공간 유지)
- [x] **"감지 중..." 하이드레이션 수정** (`tier/page.tsx`, `use-pointer-device.ts`)
  - `usePointerDevice` 훅: `useState` lazy 이니셜라이저로 클라이언트 즉시 판별, `try-catch` 추가
  - `tier/page.tsx`: `null` 상태 제거, `suppressHydrationWarning` 추가
- [x] **LAN 모바일 HMR** (`next.config.ts`)
  - `allowedDevOrigins`에 집/회사 LAN IP 추가 (필요 시 수정)
- [x] **export modal 캡처 개선** (`export-modal.tsx`)
  - `position: fixed; top: 100vh` 오프스크린 컨테이너에 클론 삽입 방식으로 변경
  - 원본 DOM 조작 없음 → 모바일 화면 확대/가로 스크롤 현상 완전 제거
  - 클론 캡처 후 컨테이너 DOM에서 즉시 제거
- [x] **`apiFetch` 유틸** (`lib/api-fetch.ts`, `dashboard/page.tsx`)
  - `NEXT_PUBLIC_API_URL` 기준으로 API 호출 일원화
  - `dashboard/page.tsx`: `fetch()` → `apiFetch()` 교체

#### 완료된 기능 (8차 — 모바일 행 추가 + 하이드레이션 마무리)
- [x] **모바일에서 행 추가 실패 수정** (`tier-store.ts`)
  - 비보안 HTTP(LAN)에서 `crypto.randomUUID()` 미지원/예외 → `newTierRowId()` 폴백 (`Date.now` + 랜덤)
- [x] **티어 설정 모달 터치** (`tier-settings-modal.tsx`)
  - `onPointerDown`, `type="button"`, `max-w-[calc(100vw-2rem)]`, `touch-manipulation`
- [x] **포인터 모드 하이드레이션** (`tier/page.tsx`, `tier-board.tsx`)
  - 서버 vs 모바일 첫 렌더 문구/트리 불일치: `deviceReady`로 마운트 후에만 `matchMedia` 반영
  - `TierBoard`에 `pointerModeReady={deviceReady}` — 안내 문구와 드래그 선택 활성 여부 동기화
  - (`suppressHydrationWarning`만으로는 조건부 자식 `<span>` 트리 불일치를 막을 수 없음)

#### 완료된 기능 (9차 — 템플릿·결과 서버 저장 인프라)
- [x] **Backend** (`domain/tier/`)
  - **Hibernate JSONB**: Spring Boot 4는 API용 Jackson 3(`tools.jackson`) 위주. Hibernate 7 jsonb는 Jackson 2 `ObjectMapper` 기반 `JacksonJsonFormatMapper` 필요 → `jackson-databind:2.18.2` **implementation** + `HibernateJsonFormatMapperConfig`에서 `MappingSettings.JSON_FORMAT_MAPPER` 명시 등록 (클래스패스만 넣는 자동 탐지는 IDE/실행 환경에서 실패할 수 있음)
  - `TierTemplate` — `title`, `items`(JSONB), `parentTemplateId`(Fork), `creatorId`, `version`
  - `TierResult` — `templateId`, `userId?`, `snapshotData`(JSONB), `list_title`, `list_description`, `isPublic`, `isTemporary`(비로그인 시 true)
  - `POST /api/v1/templates`, `GET /api/v1/templates`(목록·`TemplateSummaryResponse` 최신순), `GET /api/v1/templates/{id}`(JSONB 전체·티어 풀 복원), `POST /api/v1/images`(멀티파트·바탕화면 `pickty_uploads` 저장·URL 반환), `WebMvcConfig`로 `/uploads/**` 정적 매핑, `POST /api/v1/tiers/results`, `GET /api/v1/tiers/results/mine`(로그인·본인 `TierResult` 요약 목록), `GET /api/v1/tiers/results/{id}` (Guest First, JWT 있으면 작성자 연동)
  - `TierResultCacheService` — Valkey `tier:result:{uuid}` JSON 캐시 TTL 5분
  - `TierStatisticsService` — `countByTemplate_Id` 뼈대 (JSONB 집계는 추후)
- [x] **Frontend**
  - `tier-store`: `templateId` + `setTemplateId`, `loadTemplateWorkspace`, `resetBoard` 시 초기화
  - `lib/tier-snapshot.ts`, `lib/tier-api.ts` (`listTemplates`, `listMyTierResults`, `getTemplate`, `getTierResult`, `templatePayloadToTierItems`)
  - GNB 로그인 시 **내 정보** 드롭다운 — 내 계정 / 내 티어표 / 로그아웃
  - `/template/new`, `lib/schemas/template-new.ts` — 템플릿 작성 폼(MVP)
  - **「저장 | 다운로드」** → `ExportModal`: **비로그인**은 예전과 같이 로그인 안내 + **이미지 다운로드만** / **로그인** 시에만 제목·설명 + **저장**(서버) + 이미지 다운로드
  - 로그인 상태에서 **이미지 다운로드** 후에는 비로그인용「다운로드 완료·로그인 유도」화면을 띄우지 않음
  - 로그인 패널 상단 안내 문구: 짧은 한 줄 형태로 유지(구버전 톤)
  - `lib/api-fetch.ts`·`login/page.tsx`: `NEXT_PUBLIC_API_URL`이 **빈 문자열**이면 `??`가 동작하지 않아 상대 경로로 Next에 붙어 **404**가 나므로 `trim()` 후 비어 있으면 `http://localhost:8080` fallback
  - `POST /api/v1/templates`, `POST /api/v1/images`, `POST /api/v1/tiers/results`, `GET /api/v1/tiers/results/mine` — **인증 필수** (임시 링크 저장 없음)
  - `/tier/result/[id]` — `TierBoardReadonly` + **PNG 다운로드** (캡처 ref는 티어 행만·미분류 풀 제외 — 메이커 `ExportModal`과 동일) · Pickty `/uploads/*` CORS 등은 기존과 동일

#### 남은 작업 (Tier Maker)
- [ ] **템플릿 작성 고도화** — R2 업로드 연동 후 `imageUrl` 정책·GNB/랜딩 진입점 정리; (선택) 저장 시 자동 템플릿과 필드/플래그로 구분
- [x] **내 저장 티어 결과** — `/tier/my` + `GET .../tiers/results/mine` + GNB 내 정보 메뉴 (페이지네이션·필터는 추후)
- [ ] **바탕화면 임시 저장 로직을 Cloudflare R2 객체 스토리지 업로드 로직으로 마이그레이션**
- [ ] **업로드된 이미지 리사이징/압축 처리** (프론트 또는 백엔드)
- [ ] 스트리머 방 휘발성 세션 / TTL 배치 삭제
- [ ] 임시 결과 → 로그인 후 계정 귀속(마이그레이션) API
