**트레이드오프:** 이 가이드라인은 속도보다 '신중함'을 우선합니다. 사소한 작업의 경우 상황에 맞게 유연하게 판단하세요.

## 1. 코딩 전에 생각하기 (Think Before Coding)

**임의로 추측하지 마세요. 혼란스러운 부분을 숨기지 마세요. 트레이드오프를 명확히 드러내세요.**

구현을 시작하기 전에:
- 가정을 명시적으로 밝히세요. 불확실한 점이 있다면 질문하세요.
- 여러 가지로 해석될 여지가 있다면 모두 제시하세요. 조용히 하나만 선택해서 진행하지 마세요.
- 더 단순한 접근법이 있다면 제안하세요. 필요하다면 반대 의견을 내세요.
- 명확하지 않은 부분이 있다면 멈추세요. 무엇이 헷갈리는지 구체적으로 짚고 질문하세요.

## 2. 단순함 우선 (Simplicity First)

**문제를 해결하는 최소한의 코드만 작성하세요. 추측성 코드를 작성하지 마세요.**

- 요청받지 않은 기능은 추가하지 마세요.
- 단발성(일회성) 코드를 위해 추상화를 적용하지 마세요.
- 요청되지 않은 "유연성"이나 "설정 가능성"을 부여하지 마세요.
- 발생할 리 없는 시나리오를 대비한 에러 처리 코드를 넣지 마세요.
- 200줄로 짠 코드를 50줄로 줄일 수 있다면 다시 작성하세요.

스스로에게 질문하세요: "시니어 엔지니어가 보기에 과하게 복잡한가?" 만약 그렇다면 단순화하세요.

## 3. 정밀한 수정 (Surgical Changes)

**반드시 필요한 부분만 수정하세요. 본인이 어지럽힌 부분만 정리하세요.**

기존 코드를 수정할 때:
- 인접한 코드나 주석, 포맷팅을 임의로 "개선"하지 마세요.
- 멀쩡히 작동하는 코드를 리팩터링하지 마세요.
- 본인의 선호와 다르더라도 기존 코드 스타일을 따르세요.
- 작업과 무관한 '죽은 코드(dead code)'를 발견하면 언급만 하고 삭제하지 마세요.

본인의 수정으로 인해 고아(orphan) 코드가 발생한 경우:
- **본인의 변경 사항 때문에** 사용되지 않게 된 import문/변수/함수만 제거하세요.
- 명시적인 요청이 없는 한, 기존부터 존재하던 죽은 코드는 제거하지 마세요.

검증 기준: 변경된 모든 코드 라인은 사용자의 요청과 직접적으로 연결되어야 합니다.

## 4. 목표 주도 실행 (Goal-Driven Execution)

**성공 기준을 정의하고, 검증될 때까지 반복하세요.**

작업을 검증 가능한 목표로 변환하세요:
- "유효성 검사 추가" → "잘못된 입력값에 대한 테스트를 작성한 후, 이를 통과시키기"
- "버그 수정" → "버그를 재현하는 테스트를 작성한 후, 이를 통과시키기"
- "X 리팩터링" → "리팩터링 전후로 테스트가 모두 통과하는지 확인하기"

여러 단계의 작업인 경우 간략한 계획을 제시하세요:
```
1. [단계] → 검증: [확인 항목]
2. [단계] → 검증: [확인 항목]
3. [단계] → 검증: [확인 항목]
```

---

# Pickty — 프로젝트 컨텍스트

티어표 메이커 + 이상형 월드컵 메이커 UGC 플랫폼. 작업 전 `PROGRESS.md` 를 먼저 읽어 현재 진행 상태를 파악할 것. 세부 날짜별 맥락이 필요하면 `progress/` 폴더의 보관본을 참조.

## 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Frontend | Next.js App Router | 16.x |
| Frontend | React | 19 |
| Frontend | Tailwind CSS | 4.x (CSS 변수 방식, `tailwind.config.js` 없음) |
| Frontend | 상태관리 | Zustand |
| Frontend | 폼 | react-hook-form 7.x + zod 4.x |
| Frontend | DnD | dnd-kit |
| Backend | Kotlin | 2.2.x |
| Backend | Spring Boot | 4.0.x (Spring Framework 7, Jackson **3.x**) |
| Backend | JVM | Java 25 |
| DB | PostgreSQL | 17.x |
| Cache | Valkey | 9.x (Redis 호환) |
| 이미지 스토리지 | Cloudflare R2 | 버킷 `pickty-images`, 공개 `img.pickty.app` |
| 프론트 배포 | Vercel | `main` push → 자동 빌드 |
| 백엔드 배포 | AWS Lightsail (서울) | GitHub Actions — `backend/**` 또는 `deploy/lightsail/**` 변경 시만 트리거 |

## 레포 구조 (모노레포)

```
Pickty/
├── frontend/          # Next.js 16 App Router
├── backend/           # Kotlin Spring Boot 4
├── docs/              # 마이그레이션 SQL, 인프라 설계 문서
│   └── migrations/    # Flyway 증분 마이그레이션
├── deploy/lightsail/  # 서버 환경 구성
└── docker-compose.yml # 로컬 DB(Postgres 호스트 5442) + Valkey(6380)
```

## 브랜치 · 배포

| 브랜치 | 용도 |
|--------|------|
| `dev` | 기본 개발 브랜치. 항상 여기서 작업 |
| `main` | 배포용. 직접 push 금지, `dev` PR 머지로만 반영 |

- **프론트**는 `main`에 올라오면 **Vercel**이 자동 빌드 (`frontend/**` 변경도 반응)
- **백엔드**는 `backend/**` 또는 `deploy/lightsail/**` 변경이 포함된 `main` push 시만 **GitHub Actions** 트리거
- 프론트만 고쳤는데 "Actions에 배포가 안 뜬다" → **정상**. Vercel 빌드를 확인

## 로컬 개발

```bash
# 로컬 DB/Cache 기동 (선택)
docker compose --env-file .env up -d   # Postgres 5442, Valkey 6380

# 백엔드 실행
./gradlew bootRun          # dev 프로필 (pickty_dev DB)
./gradlew bootRunLocal     # local 프로필 (로컬 Docker DB)
./gradlew test             # Testcontainers 사용 (Docker 필요)

# 프론트 실행
cd frontend && npm run dev  # localhost:3002
```

- 시크릿 파일(`application-secrets.yaml`, `application-local.yaml`, `.env`, `frontend/.env.local`)은 **`pickty-config`** 비공개 레포에서 복사. 이 레포에는 절대 커밋 금지
- Spring 프로필: `dev`(기본·공용 `pickty_dev` DB) / `local`(로컬 Docker `pickty` DB) / `prod`

## 코딩 규칙

### Frontend
- **App Router만** 사용 (`pages/` 디렉토리 금지)
- `'use client'` / `'use server'` 명시 철저히 구분
- Tailwind v4 방식 — CSS 변수로 테마 관리 (`@theme inline`, `globals.css`)
- 파일명 `kebab-case`, 컴포넌트명 `PascalCase`

### Backend — Jackson 3.x 패키지명 (중요)
Spring Boot 4.x = Jackson **3.x**. 패키지명 ```tools.jackson```

### Backend — CORS 설정
`SecurityConfig`에 `CorsConfigurationSource` 빈 필수. 없으면 프론트 API 호출이 전부 막힘.

## URL 라우팅 규칙

`/{도메인}/{리소스(복수형)}/{행위 또는 ID}` 패턴.

| 영역 | 주요 경로 |
|------|-----------|
| 티어 템플릿 | 목록 `/tier/templates`, 새로 만들기 `/tier/templates/new`, 내 것 `/tier/templates/my`, 플레이 `/tier/templates/{id}`, 빈 메이커 `/tier` |
| 티어 결과 | 피드 `/tier/results`, 상세 `/tier/results/{id}`, 내 목록 `/tier/results/my` |
| 월드컵 | 허브 `/worldcup/templates`, 새로 만들기 `/worldcup/templates/new`, 플레이 `/worldcup/templates/{id}` |
| 커뮤니티 | 목록 `/community`, 작성 `/community/write`, 상세 `/community/[id]` |

- 본인 소유 목록은 `mine` 대신 **`my`** 사용
- 특정 리소스 ID는 path variable, 필터·검색·페이지네이션은 query parameter

## UGC 삭제·수정 정책

- **물리 DELETE 없음** — 상태 컬럼을 `DELETED`로 소프트 삭제
- 수정: 회원 = 작성자 본인만 / 비회원 = 비밀번호 일치 / ADMIN = 타인 글 수정 불가
- 삭제: 회원 = 작성자 본인 / 비회원 = 비밀번호 / ADMIN = 종류·비밀번호 무관 즉시 삭제 가능

## 보안

민감정보(`API Key`, DB 비밀번호, JWT Secret 등)는 **반드시 gitignore된 파일에만** 작성.  
`PROGRESS.md`, 커서룰즈, 소스코드에 실제 값 절대 기입 금지. 플레이스홀더 사용.

## 이미지 처리

- 업로드: `uploadPicktyImages` → WebP 압축(장변 1024, ~0.5MB) → `POST /api/v1/images` → R2
- 표시: `picktyImageDisplaySrc` 또는 `GET /api/v1/images/file/{key}`
- 외부 이미지 / Canvas 접근: `GET /api/pickty-image?url=` (SSRF 완화 포함)
- 업로드 한도: 8MB (Nginx · Spring multipart · Tomcat 동일)