# Pickty 아키텍처 · 인프라 구성도

> 다이어그램은 Mermaid로 작성. GitHub · VSCode(미리보기) · Cursor에서 바로 렌더링됨.
> 인프라가 바뀌면 이 문서의 해당 블록만 수정할 것.

---

## 1. 인프라 / 배포 구성도

운영 환경 전체 그림. 프론트(Vercel)와 백엔드(Lightsail)가 분리 배포되고, 이미지는 Cloudflare R2가 담당한다.

```mermaid
flowchart TB
    subgraph Client["사용자"]
        Browser["브라우저"]
    end

    CF["Cloudflare 프록시<br/>SSL/TLS: Full (Strict) · Cache Rule 엣지 캐시"]

    subgraph Vercel["Vercel"]
        Next["Next.js 16 App Router<br/>pickty.app<br/>(+ /api/pickty-image 외부 이미지 프록시)"]
    end

    subgraph Lightsail["AWS Lightsail (서울) — 2 vCPU · 2GB RAM · 60GB SSD"]
        subgraph DockerNet["Docker 네트워크: pickty-infra_default"]
            Nginx["Nginx (443, SSL 종료)<br/>Cloudflare Origin Cert<br/>client_max_body_size 8m"]
            API["pickty-api (Spring Boot 4 · Kotlin)<br/>:8080 (외부 미개방)<br/>프로필: prod"]
            PG[("PostgreSQL 17<br/>pickty_prod / pickty_dev")]
            VK[("Valkey 9<br/>캐시 · Redis 호환")]
        end
    end

    subgraph R2["Cloudflare R2"]
        Bucket[("버킷: pickty-images<br/>공개: img.pickty.app")]
    end

    Browser -->|"pickty.app<br/>(DNS 전용 — Vercel 직결)"| Next
    Browser -->|"api.pickty.app (프록시)"| CF
    Browser -->|"img.pickty.app (프록시)"| CF
    CF --> Nginx
    CF -->|"엣지 캐시 1년 (§4)"| Bucket
    Next -.->|"이미지 프록시 fetch"| Bucket
    Nginx -->|"proxy_pass"| API
    API --> PG
    API --> VK
    API -->|"S3 호환 API (업로드·삭제)"| Bucket
```

### 배포 파이프라인

```mermaid
flowchart LR
    Dev["dev 브랜치<br/>(기본 작업 브랜치)"] -->|"PR 머지"| Main["main 브랜치"]

    Main -->|"frontend/** 변경 포함 push"| VercelBuild["Vercel 자동 빌드·배포"]
    Main -->|"backend/** 또는<br/>deploy/lightsail/** 변경 시만"| GHA["GitHub Actions<br/>deploy-backend.yml"]

    GHA -->|"SSH (appleboy/ssh-action)"| LS["Lightsail 서버"]
    LS --> Steps["1. TLS 인증서 기록 (GitHub Secrets)<br/>2. git pull origin main<br/>3. application-secrets.yaml 존재 확인<br/>4. docker compose down → up -d --build"]

    Secrets["pickty-config 비공개 레포<br/>(application-secrets.yaml 등)"] -.->|"deploy-secrets 워크플로 / 수동 scp"| LS
```

- 프론트만 고친 push는 GitHub Actions가 **돌지 않는 게 정상** — Vercel 빌드를 확인할 것.
- 시크릿은 Pickty 레포에 없음. `pickty-config` 비공개 레포에서 서버로 배치.

---

## 2. 시스템 아키텍처 (논리 구조)

```mermaid
flowchart TB
    subgraph FE["Frontend — Next.js 16 (React 19)"]
        Pages["App Router 페이지<br/>tier / worldcup / community / profile ..."]
        State["Zustand (상태) · react-hook-form + zod (폼) · dnd-kit (DnD)"]
        ImgProxy["/api/pickty-image (Route Handler)<br/>외부 이미지 프록시 · SSRF 완화 · 오픈프록시 차단"]
    end

    subgraph BE["Backend — Spring Boot 4 (Kotlin 2.2, Java 25, Jackson 3.x)"]
        subgraph Global["global"]
            Sec["security · jwt · oauth2 · CORS"]
        end
        subgraph Domain["domain"]
            Tier["tier (티어표)"]
            WC["worldcup (이상형 월드컵)"]
            Comm["community (게시판)"]
            Prof["profile (겜생프로필)"]
            Strm["streamer (스트리머 모드)"]
            AI["ai (자동 생성 배치)"]
            Up["upload (이미지)"]
            Etc["user · auth · interaction · view · admin"]
        end
        ORM["JPA (Hibernate) + Flyway 마이그레이션"]
    end

    subgraph Store["저장소"]
        PG[("PostgreSQL 17")]
        VK[("Valkey 9 캐시")]
        R2[("Cloudflare R2<br/>pickty-images")]
    end

    subgraph Ext["외부 API"]
        OAuth["OAuth: Google · Kakao · Naver"]
        Gemini["Gemini 2.5 Flash<br/>(무료 20회/일)"]
        YT["YouTube Data API<br/>(무료 ≈100건/일)"]
        GCS["Google Custom Search"]
        Wiki["Wikimedia (이미지 소스)"]
    end

    Pages -->|"REST /api/v1/*"| Sec
    Sec --> Domain
    Domain --> ORM --> PG
    Domain --> VK
    Up --> R2
    Sec --> OAuth
    AI --> Gemini
    AI --> YT
    AI --> GCS
    AI --> Wiki
    AI --> R2
```

---

## 3. 주요 플로우

### 3-1. 이미지 업로드 · 표시

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant FE as Next.js
    participant API as Spring Boot
    participant R2 as Cloudflare R2

    Note over B: 업로드 (uploadPicktyImages)
    B->>B: Canvas로 WebP 압축<br/>(장변 1024px, ~0.5MB)
    B->>API: POST /api/v1/images (multipart, 한도 8MB)
    API->>R2: S3 호환 API로 저장
    API-->>B: 이미지 key 반환

    Note over B: 표시 (picktyImageDisplaySrc)
    B->>R2: img.pickty.app/{key} (공개 URL, 기본 경로)
    alt 공개 URL 불가 시 폴백
        B->>API: GET /api/v1/images/file/{key}
        API->>R2: 객체 조회
        API-->>B: 이미지 스트림
    end

    Note over B: 외부 이미지 (Canvas 접근 필요 시)
    B->>FE: GET /api/pickty-image?url=...
    FE->>FE: SSRF 완화 · 오픈프록시 어뷰징 차단
    FE-->>B: 프록시된 이미지
```

### 3-2. 소셜 로그인 (OAuth2 + JWT)

```mermaid
sequenceDiagram
    participant B as 브라우저
    participant FE as Next.js (pickty.app)
    participant API as Spring Boot (api.pickty.app)
    participant P as OAuth 제공자<br/>(Google / Kakao / Naver)

    B->>FE: /login 페이지
    B->>API: GET /oauth2/authorization/{provider}
    API->>P: 인가 요청 리다이렉트
    P-->>API: GET /login/oauth2/code/{provider} (인가 코드)
    API->>P: 토큰 교환 + 사용자 정보 조회
    API->>API: 회원 조회/생성 → JWT 발급
    API-->>B: refresh 토큰 쿠키 설정<br/>(7일, Secure, SameSite=Lax)
    API-->>B: 프론트로 리다이렉트 (허용 origin만)
    B->>API: 이후 요청: access 토큰 (1시간) 사용,<br/>만료 시 refresh 쿠키로 재발급
```

### 3-3. AI 콘텐츠 자동 생성 배치

Gemini 무료 한도(20회/일, 실패도 차감)를 두 배치가 공유. 미국 한낮(KST 새벽) 503 회피를 위해 KST 저녁대에 실행.

```mermaid
sequenceDiagram
    participant S1 as 이미지 배치<br/>(@Scheduled KST 18:13)
    participant S2 as 유튜브 배치<br/>(@Scheduled KST 18:47)
    participant G as Gemini 2.5 Flash
    participant W as Wikimedia
    participant Y as YouTube Data API
    participant R2 as R2
    participant DB as PostgreSQL

    Note over S1: 먼저 실행해 Gemini 쿼터 일부만 선점
    S1->>G: 주제·아이템 생성 (503 시 재시도)
    S1->>W: 아이템 이미지 검색·다운로드
    S1->>S1: WebP 압축
    S1->>R2: 이미지 영속화
    S1->>DB: 티어 1개 + 월드컵 1개 저장<br/>(작성자: ADMIN creator-id)

    Note over S2: 유튜브 일일 쿼터 100건 예산 내 실행
    S2->>G: 주제 생성 (남은 쿼터 사용)
    S2->>Y: 영상 검색 (아이템 1개 = 1회 차감)
    S2->>DB: 유튜브 월드컵 템플릿 저장
```

---

## 4. 이미지 캐시 전략

이미지 URL은 **불변(immutable)** 을 전제로 설계됨. 업로드마다 새 UUID 키가 발급되고(`R2ImageStorageService` — 같은 키에 덮어쓰기 경로 없음), "이미지 수정"은 항상 새 업로드 + DB 참조 교체로 처리한다.

| 레이어 | 설정 | 위치 |
|--------|------|------|
| Cloudflare 엣지 | Cache Rule로 `img.pickty.app` 전체 + `/api/v1/images/file/*` 경로를 엣지·브라우저 TTL 1년 강제 캐싱 (원본 헤더 무시) | Cloudflare 대시보드 (레포 밖) |
| 백엔드 file API | `Cache-Control: public, max-age=31536000, immutable` | `ImageUploadController` |
| Next.js 이미지 프록시 | 1일~1시간 + stale-while-revalidate (외부 URL은 불변 보장이 없으므로 짧게) | `pickty-image/route.ts` |

### 지켜야 할 불변식

- **저장된 객체 키에 절대 덮어쓰지 않는다.** 같은 키에 다른 내용을 쓰면 엣지·브라우저에 최대 1년 묵은 이미지가 남는다. 내용이 바뀌면 반드시 새 키 발급.
- R2 고아 객체 정리(`ImageCleanupService`)로 객체를 지워도 **엣지 캐시는 자동으로 비워지지 않는다.** 즉시 노출 중단이 필요한 삭제(개인정보 등)는 Cloudflare 캐시 퍼지(URL 단위)를 별도로 수행해야 한다.

---

## 5. 환경 구분

| 환경 | Spring 프로필 | DB | 비고 |
|------|---------------|-----|------|
| 운영 | `prod` | `pickty_prod` (Lightsail) | `main` 머지로만 배포 |
| 공용 개발 | `dev` (기본) | `pickty_dev` (Lightsail) | `./gradlew bootRun` |
| 로컬 격리 | `local` | `pickty` (로컬 Docker, 호스트 5442) | `./gradlew bootRunLocal`, Valkey 6380 |

- 단일 Postgres 인스턴스에 `pickty` / `pickty_dev` / `pickty_prod` DB를 분리 운영.
- 프론트 로컬: `cd frontend && npm run dev` → `localhost:3002`.

---

## 6. 외부 콘솔 및 보안 설정 (Console & Security Configuration)

> 레포 코드만으로는 추적할 수 없는 웹 콘솔 설정 기록. **공개 레포이므로 시크릿 값·IP 주소 등 구체 값은 적지 않는다** — 설정의 존재와 개념만 기록. (확인일: 2026-06)

### Cloudflare

| DNS 레코드 | 대상 | 프록시 상태 |
|------------|------|-------------|
| `pickty.app` (A) | Vercel | **DNS 전용** (회색 구름 — Vercel 직결, Cloudflare 규칙 미적용) |
| `api.pickty.app` (A) | Lightsail | **프록시 ON** (주황 구름) |
| `img.pickty.app` (CNAME) | R2 커스텀 도메인 | **프록시 ON** (주황 구름) |

- SSL/TLS 암호화 모드: **Full (Strict)** — Cloudflare Origin Certificate 기반으로 원본 인증서까지 엄격 검증
- Cache Rule "Pickty Image Cache" (우선순위 1) — 상세는 §4 이미지 캐시 전략 참조
- WAF·봇 보안: 커스텀 차단 규칙 없음, 기본 보안 모드

### AWS Lightsail

- 인스턴스: **2 vCPU · 2GB RAM · 60GB SSD** (서울 리전)
- IPv4 방화벽 (최소 개방 원칙):
  - 외부 개방: `22(SSH)` · `443(HTTPS)` 뿐 — `80(HTTP)`은 규칙에서 제거됨 (Nginx가 443만 리슨하므로 불필요)
  - `5432(PostgreSQL)` · `6379(Valkey)`: **지정된 개발 PC IP 화이트리스트만 허용** (구체 IP는 비공개)
- 백업: 차후 활성 사용자 발생 시 상용 백업 정책으로 **인스턴스 스냅샷 도입 예정**

### Google Cloud Platform (API 키)

| 키 | API 제한 | 비고 |
|----|----------|------|
| Gemini | Gemini API 전용 | — |
| YouTube Search | YouTube Data API v3 전용 | — |
| Custom Search | Custom Search API 전용 | 현재 외부 요인으로 사용 불가 상태 |

- 모든 키는 기능별 API 접근 제한 적용 완료. 현재 무료 티어 활용 단계로, 향후 유료 플랜 전환 시 **서버 고정 IP 제한(애플리케이션 제한)** 적용 예정.

### Vercel

- 환경변수: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GA_ID` 등 콘솔에서 주입 (값은 콘솔에서만 관리)
- 프로덕션 도메인: `pickty.app`, `pickty.vercel.app`

### 소셜 로그인 콘솔

- **Kakao Developers**: **비즈 앱** 전환 완료
- **Google OAuth (GCP)**: 승인된 도메인에 운영(`pickty.app`)과 로컬 테스트 환경(`*.ngrok-free.dev`) 매핑. 앱 상태는 정식 검수 전 단계
- **Naver Developers**: 애플리케이션 상태 **[서비스 적용]** (운영 모드) 활성화

### GitHub

- 기본 브랜치: **`dev`** (작업 베이스) — `main`은 배포 트리거 전용, PR 머지로만 반영
- 브랜치 보호 규칙: 현재는 시스템 강제 없이 개발 편의를 위해 **자율적 관례 플로우**로 운영 중. 향후 협업 규모 확장 시 보호 규칙 도입 검토 예정
- Actions Secrets: Lightsail SSH 접속 정보(host·username·key)와 TLS 인증서(cert·key) — `deploy-backend.yml`에서 사용
