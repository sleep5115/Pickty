# Pickty 진행 현황

> 웹 AI(Gemini)에게 컨텍스트를 전달하기 위한 파일.
> 작업할 때마다 Cursor AI가 이 파일을 업데이트한다.

---

## 레포 구조 (모노레포)

- **레포**: https://github.com/sleep5115/Pickty (단일 모노레포)
- `frontend/` — Frontend (Next.js App Router)
- `backend/` — Backend (Kotlin, Spring Boot)
- `docker-compose.yml` — PostgreSQL 17 + Valkey 9 **선택(로컬 PC 전용)**. 호스트 **5442·6380** → 컨테이너 5432·6379(집·회사 동일). **`POSTGRES_PASSWORD`** 는 루트 **`.env`**. 공용 개발은 Lightsail 등 — 프로필 **`dev`** + `application-secrets.yaml`
- `PROGRESS.md` — 이 파일 (루트 단일 파일로 관리)
- `docs/LOCAL-DEV.md` — **로컬 실행 메모** (Windows, JDK 25 세션 설정·프론트 포트 3002·`dev` 프로필 등)

### 브랜치 전략
| 브랜치 | 용도 |
|---|---|
| `main` | 배포용 — 직접 push 금지, `dev` PR로만 머지. 머지 시 자동 배포 예정 |
| `dev` | 기본 브랜치 — 평소 개발 작업 |

---

## Phase 4 — 운영 인프라 (목표)

| 구분 | 계획 |
|------|------|
| 백엔드·DB 호스팅 | **AWS Lightsail** (서울 `ap-northeast-2`) — Spring Boot + **PostgreSQL** + **Valkey** (Docker) |
| 이미지 스토리지 | **Cloudflare R2** (AWS S3 API 호환, Egress 무료) |
| 프론트엔드 배포 | **Vercel** 또는 별도 컨테이너 |

### 인프라 확정 방향 — 생각 흐름 요약 (2026-03)

- **왜 Lightsail(서울) + R2인가**: 헤츠너 등은 가입/KYC 이슈로 제외. Lightsail은 **서울 리전**·카드 가입이 수월하고, 이미지 egress는 **R2**로 분리. 웹소켓 없이 “초대 URL → 제출 → 집계 표시”면 API 지연 요구가 상대적으로 낮음. 성공 후에는 **RDS·EC2 등으로 쪼개기** 또는 타 클라우드 이전 가능. DB 덤프/복원 시 **OAuth·CORS·쿠키·Redis·객체 URL** 체크. R2는 **S3 호환**이라 엔드포인트/키 주입형이면 이후에도 유지·이전이 쉬움.
- **대량 유입(바이럴)**: 한 VPS의 물리 한계 + **DB·캐시(Valkey)·쿼리·집계 캐시** 설계가 병목. Lightsail 번들 업·이미지 CDN·필요 시 RDS/EC2 분리로 대응.
- **개발 단계 운용 (합의)**  
  - **PostgreSQL / Valkey**: **Lightsail Ubuntu + Docker** 등 **단일 Postgres**에 **`pickty_dev` / `pickty_prod`** 로 분리. 집/회사 PC는 기본 **`dev`**(공용 DB면 `DB_HOST`/`VALKEY_HOST`) 또는 **`local`**(로컬 compose만). OAuth·JWT는 **`application-secrets.yaml`**; **`local`** 전용 연결은 **`application-local.yaml`**. (USB 동기화 — PROGRESS에 실값 금지.)  
  - **이미지**: **Cloudflare R2** 업로드·공개 URL(`public-url`) 저장 (구 `pickty_uploads`·`/uploads/**` 제거).  
  - **오픈 전**: 테스트 데이터·버킷 정리 또는 prod 전용 분리, OAuth·시크릿 프로덕션 값으로 교체.

### 인프라 현황 스냅샷 — Lightsail (공개 문서·AI 컨텍스트용 요약)

| 항목 | 내용 |
|------|------|
| 플랫폼 | **AWS Lightsail**, 리전 **서울** (`ap-northeast-2`), AZ **ap-northeast-2a** |
| OS | **Ubuntu 24.04 LTS** (Noble) |
| 사양 | **2 vCPU**, **2 GB RAM**, **60 GB SSD** (번들 기준) |
| 네트워크 | **정적 IP(Static IP)** 할당 완료 — **공인 IP는 레포에 적지 않음** (Lightsail 콘솔·내부 메모 참고) |
| 방화벽 | **TCP 22** (SSH), **80**, **443** 오픈. 집/회사 PC에서 DB·Valkey 직접 붙이면 **5432·6379** 추가 — **가능하면 고정 IP만** 허용 |
| Swap | RAM 보완용 **2GB 스왑 파일** 생성·활성화 (`free -h` 기준 가용 메모리 약 4GB급 체감) |
| 컨테이너 | **Docker** 29.3.x, **Docker Compose** 설치 완료 |
| 권한 | `ubuntu` 유저 **docker 그룹** — `sudo` 없이 Docker 실행 가능 |
| DB (개발) | 인스턴스 위 **Docker**로 **PostgreSQL 17** + **Valkey 9** — 앱·업무용 DB는 **`pickty_dev`**(개발)·**`pickty_prod`**(운영). **`pickty`** 는 로컬 compose 기본 DB + Lightsail에는 DBeaver 등 접속 앵커용 **빈 DB**로 둘 수 있음(데이터 없음). |
| 이미지 스토리지 | **Cloudflare R2** 세팅 완료 — 버킷 **`pickty-images`**. S3 호환 API 엔드포인트(참고용): `https://63a49661ebdd96616e92570458c279fc.r2.cloudflarestorage.com` — **Access/Secret 키는 `pickty-config`의 `application-secrets.yaml`에만** 기록(PROGRESS·퍼블릭 레포에 비밀키 금지). |

*(**공인 IP·비밀번호**는 gitignore `application-local.yaml` 주석 / `application-secrets` 등에만. 루트 `docker-compose.yml`은 Lightsail 없을 때만 로컬 폴백.)*

#### DBeaver로 Lightsail PostgreSQL 접속 (공개 문서 — 실주소·비번 금지)

**PostgreSQL 구조 (중요)**: DB **`pickty_dev` / `pickty_prod` / `pickty`** 는 **서로 형제**(같은 클러스터 안의 **별도 데이터베이스**). 어떤 한 DB 안에 다른 DB가 **폴더처럼 들어가 있지 않음**. 그래서 “`pickty`로 접속한 뒤 그 안을 펼쳐서 `pickty_dev`가 보이게”는 **불가능**하고, **한 연결의 초기 Database는 하나만** 고른다.

**전체 DB 목록을 트리에서 보고 싶을 때**: 연결 설정에서 **Show all databases**(또는 동등 옵션)를 켠 뒤, **Database** 를 **`pickty`** 또는 **`postgres`** 중 하나로 잡으면 된다. DBeaver **Databases** 노드를 펼치면 **`pickty`**, **`pickty_dev`**, **`pickty_prod`**, **`postgres`** 등이 **같은 레벨(형제)** 로 보인다(한 DB 안에 다른 DB가 들어가 있는 구조는 아님).

**`postgres` DB가 뭐냐**: `initdb` 할 때 자동 생성되는 **관리용 기본 DB**. 직접 만든 적 없어도 항상 있다. **DROP 하면 안 됨** — 클러스터 유지보수·일부 도구·복구에 쓰이며, 없애면 문제 생길 수 있다. **`template0` / `template1` 도 삭제·변경 금지.**

1. Lightsail 네트워킹에서 **TCP 5432** 허용(가능하면 **본인 집/회사 고정 IP**만).
2. DBeaver → **새 연결** → **PostgreSQL**.
3. **연결 필드** (비번·IP 실값은 **Git에 올리지 말 것** — `application-secrets.yaml`·pickty-config 등 gitignore만):

| 필드 | 값 |
|------|-----|
| **Host** | Lightsail **정적 공인 IP** (`application-secrets.yaml`의 `DB_HOST`) |
| **Port** | `5432` |
| **Database** | **Show all databases 켠 상태**에서 진입점으로 **`pickty`** 또는 **`postgres`** 권장 — 트리에서 `pickty_dev`·`pickty_prod` 등 형제 DB 확인. **작업 DB만** 쓸 때는 **`pickty_dev`**(개발) / **`pickty_prod`**(운영·주의) |
| **Username** | `pickty` (Docker `POSTGRES_USER` 와 동일; `pickty_user` 아님) |
| **Password** | `application-secrets.yaml`의 **`DB_PASSWORD`**(로컬 compose `POSTGRES_PASSWORD` 와 맞춤) |

4. **SSL** 은 보통 **비활성** 또는 기본값.
5. **Test connection** → 저장.

*(PROGRESS 본문에는 비밀번호 문자열을 적지 말 것 — 보안 규칙.)*

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
| Tier Maker (미구현) | ⬜ 예정 | **R2** 리사이즈·CDN·스트리머 방 TTL, 임시→계정 **마이그레이션** (업로드는 **Cloudflare R2** + 공개 URL **`img.pickty.app`** 커스텀 도메인) |
| Ideal Type World Cup | ⬜ 미시작 | |

### 진행 스냅샷 (2026-03 후반)

- **템플릿 허브**: `/templates` — `GET /api/v1/templates`로 **DB 템플릿 목록** 표시(최신순)·하단 예시 데모 카드 유지·**새 템플릿 만들기** → `/template/new`.
- **이미지 저장(현재)**: `POST /api/v1/images` → **AWS SDK S3 호환 클라이언트**로 **Cloudflare R2** `PutObject`. DB `items` JSON에는 **`https://img.pickty.app/…`**(또는 설정한 `public-url`) 형태. **dev·prod 프로필 구분 없이** `application-secrets`의 **동일 버킷**에 객체 키는 **`{uuid}.{확장자}`** 단일 평면(폴더/`dev/` 접두사 없음). 프론트 기본 API는 **`https://api.pickty.app`**, 사이트 **`https://pickty.app`** — Mixed Content 방지 전제. 화면 표시는 **`GET /api/v1/images/file/{key}`** 로 API 경유(비공개 R2도 표시 가능).
- **템플릿 작성(밀키트)**: `/template/new` — 제출 시 **`POST /api/v1/images`**(FormData·다건) → 반환 URL을 `imageUrl`에 매핑 후 **`POST /api/v1/templates`**. 미리보기는 로컬 blob 유지. 저장 완료 패널·내 정보 안내 동일.
- **티어 메이커**: `?templateId=` 쿼리 시 `GET /api/v1/templates/{id}`로 풀 복원(`loadTemplateWorkspace`). PC/모바일 UX·하이드레이션·LAN 등 기존 플로우 유지.
- **내 티어표**: GNB **내 정보 ▾** → `/tier/my` · API `GET /api/v1/tiers/results/mine`(JWT).
- **알려진 개발 콘솔**: `next-themes` 인라인 script 관련 React 19 경고는 라이브러리 한계(동작은 Recoverable 수준).
- **이미지 업로드 413**: (1) Tomcat `maxPostSize` — `application.yaml`의 `server.tomcat.*` + **`TomcatMaxPostSizeCustomizer`**(Boot 4는 `org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory`). (2) **일부 프록시는 요청당 본문 제한**이 있어 한 번에 여러 파일 POST 시 413이 남 → 프론트는 **`uploadPicktyImages`에서 파일마다 순차 `POST /api/v1/images`**(본문 1개씩). 단일 파일도 너무 크면 여전히 413 가능.
- **로컬 `next/image` 400:** 템플릿 썸네일이 `/_next/image?url=http://localhost:8080/...` 를 쓸 때, Next 16 기본 **`images.dangerouslyAllowLocalIP: false`** 면 루프백 페치가 막혀 **400** — `next.config.ts`에 **`dangerouslyAllowLocalIP: true`** (`remotePatterns`와 별개). 티어 타일은 `<img>` 직링크라 동일 증상 없음.

### 세션 메모 (2026-03 후반)

- **개발 DB**: Lightsail 은 **`pickty_dev` / `pickty_prod`**(앱) + DBeaver용 빈 **`pickty`**. **`dev` / `local` 프로필** 모두 **`DB_HOST`·`VALKEY_HOST`** 등 secrets 로 원격 붙음(`pickty_dev`). 선택 폴백만 Docker **5442·6380**(`docker-compose.yml`). **`./gradlew bootRun`**(`dev`) / **`bootRunLocal`**(`local`). Spring 비번·OAuth·R2는 **`application-secrets.yaml`**. Lightsail 방화벽 **5432·6379** 는 가능하면 **본인 IP만**.

### 세션 메모 (2026-03-23)

- **배포·연동 점검**: `docs/DEPLOYMENT-CHECKLIST.md` — Google 리디렉션 URI·Vercel env·Mixed Content/CORS·`npm run verify:deploy`.
- **도메인·HTTPS**: 프론트 기본 `https://api.pickty.app` / `https://pickty.app`, R2 공개 **`https://img.pickty.app`**. Google Cloud Console **승인 리디렉션 URI**에 `https://api.pickty.app/login/oauth2/code/google` 등 API 오리진 등록. 백엔드는 리버스 프록시 뒤 **`server.forward-headers-strategy: native`**(secrets) 유지.
- **R2 업로드 마이그레이션**: `software.amazon.awssdk:s3` + `CloudflareR2Properties` / `r2S3Client` Bean(`Region.of("auto")`, path-style). `R2ImageStorageService`·`POST /api/v1/images`는 **`public-url` + `/` + 객체키** URL 반환. `WebMvcConfig`·`/uploads/**` CORS·`pickty_uploads` 제거. `pickty-config`에 **`public-url`** 추가 후 `application-secrets.yaml`을 백엔드로 복사 필요.
- **pickty-config**: `application-secrets.yaml` · **`application-local.yaml`**(Lightsail `pickty_dev` + Valkey, secrets 변수) · **`gradle.properties.pickty-*`**(권장: **JAVA_HOME**, 미사용 시 `REPLACE_ME` 경로만 활성화) · `.env` · **PEM** · `frontend.env.local`(HTTPS API/사이트 URL).
- **pickty-config**(이전): Pickty 메인은 플레이스홀더만 유지. 메인 **`.gitignore`의 `pickty-config/`** 로 워크스페이스 내 설정 레포 클론 시 실수 커밋 방지.

### 세션 메모 (2026-03-21)

- **Lightsail Postgres**: 앱용 **`pickty_dev` / `pickty_prod`**. DBeaver에서 클러스터 전체 DB 목록은 초기 접속 DB **`postgres`** 로 연결 후 펼치기. **`postgres`** 는 PostgreSQL이 자동 생성하는 관리용 DB. 비밀번호는 gitignore **`application-secrets.yaml`** 의 **`DB_PASSWORD`** 에 기록(레포 비적재).
- **Spring 프로필 3종 + 단일 Postgres·다중 DB**: **`pickty`** = PC 로컬 compose 전용(선택). Lightsail 등 공용 인스턴스는 **`pickty_dev` / `pickty_prod`** 만. **`dev`**(기본): `spring.profiles.default: dev`, **`./gradlew bootRun`**, JDBC **`pickty_dev`**, **`DB_HOST`·`VALKEY_HOST`**(`application-secrets.yaml`). **`local`**: **`application-local.yaml`** — 구조는 **`dev`와 동일**(원격 `pickty_dev` + Valkey), **`bootRunLocal`**. **`prod`**: **`pickty_prod`**. OAuth·JWT·R2는 **`application-secrets.yaml`** 또는 서버 env. **`test`**: Testcontainers + Docker.
- **로컬 개발 전제**: 운영 기본값은 **`NEXT_PUBLIC_API_URL=https://api.pickty.app`**, **`NEXT_PUBLIC_SITE_URL=https://pickty.app`**(`pickty-config`의 `frontend.env.local` → `frontend/.env.local`). PC에서 Spring 을 로컬로 띄워 붙일 때만 `http://127.0.0.1:8080` 등으로 덮어씀. **`local` 프로필**은 Docker Postgres 대신 **Lightsail 과 동일 `DB_HOST`/`VALKEY_HOST`** 로 **`pickty_dev`**( `application-local.yaml` = secrets 기반).
- **옛 업로드 URL 리베이스**: DB JSON에 저장된 `https://(예전호스트)/uploads/…` 는 **`resolvePicktyUploadsUrl`** 등으로 현재 `NEXT_PUBLIC_API_URL` 오리진에 맞춤 (`pickty-image-url.ts`, `tier-api`, `tier-snapshot`, 썸네일·타일 `src`).
- **CORS**: API는 `SecurityConfig`의 `/**` CORS(허용 origins·`http://localhost:*`). **화면용 픽셀**은 **`GET /api/v1/images/file/{key}`** 응답에 **`Access-Control-Allow-Origin: *`**(캔버스·교차 출처). DB 메타 URL은 `img.pickty.app` — R2를 공개 CDN으로만 쓸 때는 버킷 **CORS** 추가 설정.
- **`<img>` / 캡처**: 티어 타일은 **`picktyImageDisplaySrc`** → API 파일 URL + 일반 `<img>`. 레거시 `/uploads/` 직링크는 **`resolvePicktyUploadsUrl`** 리베이스 유지.
- **`/tier/result/[id]`**: `TierBoardReadonly` 캡처 ref는 **티어 행만** (미분류 풀은 화면에만 표시, PNG와 메이커 `ExportModal` 동일).
- **프론트 dev 스크립트**: `"dev": "node ./node_modules/next/dist/bin/next dev -p 3002"` — Windows에서 `npm.cmd` 배치 중단 시 `Y/N` 프롬프트 완화.

### 용어·제품 정의 (혼동 방지)

| 용어 | 제품에서의 의미 | DB/코드 |
|------|-----------------|---------|
| **템플릿** | 티어표를 만들 **재료(밀키트)** — 아이템·이미지·이름이 정해진 묶음. 사용자는 티어에 올리기만 함 | `TierTemplate` (`items` JSONB 등) |
| **티어 결과** | 그 재료로 만든 **개인 배치 스냅샷** (저장·공유 링크) | `TierResult` (`snapshotData` + `templateId`) |

- **현재 구현과의 갭**: 저장 시 `templateId`가 없으면 보드 아이템으로 **`POST /api/v1/templates`가 자동 호출**되어 `tier_templates`에 한 줄이 생김. **전용 템플릿 작성 UI**는 `/template/new`로 제공됨(이미지는 **R2** 업로드).
- **내 저장 티어표**: **`GET /api/v1/tiers/results/mine`** + **`/tier/my`** 목록 · GNB **내 정보** 드롭다운에서 진입. 단건 보기는 **`/tier/result/[id]`** 유지.

---

## 완료된 작업

### 개발 환경
- **공용 DB**: Lightsail 등에 PostgreSQL 17 · Valkey 9, JDBC **`pickty_dev`** / **`pickty_prod`** 분리. PC에서는 프로필 **`dev`** 또는 로컬 **`local`**.
- **로컬 폴백**: `docker-compose.yml` — 호스트 **5442·6380**; Lightsail 미사용 시 `docker compose --env-file .env up -d`
- DB 접속·공인 IP·비밀번호·OAuth·JWT: **`pickty-config`** private 레포의 **`application-secrets.yaml`** · **`application-local.yaml`** · 루트 **`.env`** 를 Pickty 쪽 gitignore 경로에 복사 — `git pull pickty-config` 후 재복사로 동기화
- **DB 이름**: **로컬 PC** docker-compose 기본 **`pickty`** + init으로 **`pickty_dev`·`pickty_prod`**. **Lightsail** 도 동일하게 **`pickty` / `pickty_dev` / `pickty_prod`** + 시스템 **`postgres`**. **`postgres`·template* 는 DROP 금지.**
- Google OAuth2: `application-secrets.yaml`에 적용(gitignore)
- 모노레포(Pickty) 전환 완료: 기존 side_project_1, side_project_2 분리 레포 → 단일 레포 통합

### Frontend (`frontend/`)
- Next.js 16 + React 19 + Tailwind CSS v4 + TypeScript 기본 세팅 완료
- `next-themes` + `zustand` 설치
- 다크/라이트 모드 토글 구현 (`ThemeProvider`, `ThemeToggle` 컴포넌트)
- **페이지 목록**
  - `/` — 메인 랜딩 (티어 진입 → `/templates`; **이상형 월드컵은 후순위로 UI에서 숨김**)
  - `/templates` — 티어 **템플릿 목록**(`listTemplates` → `GET /api/v1/templates`) + 하단 예시 데모 · `/template/new` · `/tier?templateId=`
  - `/tier` — 티어 메이커 보드 (DnD, 행 설정, 보내기, 테마, 모바일 대응, `?templateId=`로 서버 템플릿 풀 로드)
  - `/tier/my` — 로그인 유저 **저장 티어표 목록** → `/tier/result/[id]` 링크
  - `/tier/result/[id]` — 저장된 **티어 결과** 단건 읽기 전용 보기 (공유 링크 진입)
  - `/template/new` — 템플릿(밀키트) 작성: `POST /api/v1/images` 후 `POST /api/v1/templates` · `lib/image-upload-api.ts`
  - *(미구현)* **내가 저장한 티어표 목록** 경로
  - `/worldcup` — 후순위 미구현(준비 중 화면만, GNB·메인에서 링크 없음)
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
- 서버 기동 확인 (`https://api.pickty.app` 또는 로컬 Spring 시 `http://127.0.0.1:8080`)
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
  → window.open("https://api.pickty.app/oauth2/authorization/{provider}", 500×620 팝업) (로컬 API면 해당 오리진)
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

# 2. pickty-config private 레포에서 설정 복사 (또는 USB)
#    git clone https://github.com/sleep5115/pickty-config.git
#    copy pickty-config\application-secrets.yaml backend\src\main\resources\
#    copy pickty-config\application-local.yaml backend\src\main\resources\
#    copy pickty-config\gradle.properties.pickty-home backend\gradle.properties
#    (회사 PC면 gradle.properties.pickty-work)
#    copy pickty-config\.env .env
#    copy pickty-config\LightsailDefaultKey-ap-northeast-2.pem .
#    (Pickty 레포에 secrets·.env·pem 커밋 금지)

# 3. 로컬 DB 필요 시 (호스트 5442·6380 — docker-compose.yml 과 동일)
docker compose --env-file .env up -d
```

### application-secrets.yaml / application-local / Gradle JDK (집 ↔ 회사)

**선택 로컬 Docker**: 호스트 **Postgres 5442**, **Valkey 6380** — `docker-compose.yml` 전용. 일상 개발은 Lightsail DB/Valkey(`dev`/`local` + secrets).

**JDK 경로**: 사용자명 하드코딩 대신 **`JAVA_HOME`** 권장. 미설정 시 `gradle.properties` 에 `org.gradle.java.home` 한 줄만 PC별로 활성화(`pickty-config` 샘플의 `REPLACE_ME` 참고).

| 파일 | Pickty 경로 | 비고 |
|------|-------------|------|
| `application-secrets.yaml` | `backend/src/main/resources/` | OAuth·JWT·`DB_HOST` 등 |
| `application-local.yaml` | `backend/src/main/resources/` | pickty-config 에서 복사 — Lightsail `pickty_dev` + Valkey(secrets 변수) |
| `gradle.properties` | `backend/` | pickty-config `gradle.properties.pickty-home` 또는 `pickty-work` 복사 |
| `.env` | Pickty 루트 | Docker 비번 |
| `Lightsail…pem` | Pickty 루트 | SSH용 |

#### 집에서 할 일 (pickty-config 정본)

- pickty-config 의 secrets·`application-local`·gradle 샘플·`.env`·`.pem`·`frontend.env.local` 이 Pickty에 복사본과 **일치하는지** 확인 후, 수정은 **pickty-config만** 커밋·푸시.
- **프론트** `frontend/.env.local` — 필요 시 `frontend.env.local` 정본에서 복사.

---

## 개발 진행 방향 (로드맵)

MVP 우선 원칙 — "동작하는 핵심 기능"을 먼저, 완성도는 나중에 올린다.

### Phase 1 — 뼈대
> 목표: 앱을 돌아다닐 수 있는 최소한의 구조 완성 → **대부분 완료**

- [x] 구글 OAuth2 로그인 E2E
- [x] **글로벌 레이아웃 / GNB** — 로고, 메뉴, 모바일 햄버거, 로그인 상태
- [x] **프론트 로그아웃** — Zustand 토큰 삭제 (백엔드 Valkey Refresh 무효화는 추후)
- [x] `/templates`·`/tier` 진입 경로 (랜딩·GNB — 티어 허브는 `/templates`; `/worldcup`는 URL만 존재·UI 비노출)

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
  - 드롭다운: 티어표(템플릿) / 내계정 / 로그인·로그아웃 (이상형 월드컵은 후순위로 비노출)
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
  - 좌: Pickty 로고 / 중: 티어표 링크 (현재 경로 active 스타일) / 우: 테마 토글·로그인·로그아웃
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
  - `POST /api/v1/templates`, `GET /api/v1/templates`(목록·`TemplateSummaryResponse` 최신순), `GET /api/v1/templates/{id}`(JSONB 전체·티어 풀 복원), `POST /api/v1/images`(멀티파트·**R2 `PutObject`**·`public-url` 기준 URL 반환), **`GET /api/v1/images/file/{key:.+}`**(게스트·R2 **GetObject**·UUID 파일명만), `POST /api/v1/tiers/results`, `GET /api/v1/tiers/results/mine`(로그인·본인 `TierResult` 요약 목록), `GET /api/v1/tiers/results/{id}` (Guest First, JWT 있으면 작성자 연동)
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
  - `lib/public-site-config.ts`·`api-fetch.ts`·`login/page.tsx`: `NEXT_PUBLIC_API_URL` trim 후 비어 있으면 **`https://api.pickty.app`** fallback(Mixed Content 방지)
  - `POST /api/v1/templates`, `POST /api/v1/images`, `POST /api/v1/tiers/results`, `GET /api/v1/tiers/results/mine` — **인증 필수** (임시 링크 저장 없음)
  - `/tier/result/[id]` — `TierBoardReadonly` + **PNG 다운로드** (캡처 ref는 티어 행만·미분류 풀 제외 — 메이커 `ExportModal`과 동일) · 표시 URL은 **`picktyImageDisplaySrc`** → API 파일 엔드포인트; `next.config` **`images.remotePatterns`** + 로컬용 **`dangerouslyAllowLocalIP`**

#### 남은 작업 (Tier Maker)
- [ ] **템플릿 작성 고도화** — R2 업로드 연동 후 `imageUrl` 정책·GNB/랜딩 진입점 정리; (선택) 저장 시 자동 템플릿과 필드/플래그로 구분
- [x] **내 저장 티어 결과** — `/tier/my` + `GET .../tiers/results/mine` + GNB 내 정보 메뉴 (페이지네이션·필터는 추후)
- [ ] **바탕화면 임시 저장 로직을 Cloudflare R2 객체 스토리지 업로드 로직으로 마이그레이션**
- [ ] **업로드된 이미지 리사이징/압축 처리** (프론트 또는 백엔드)
- [ ] 스트리머 방 휘발성 세션 / TTL 배치 삭제
- [ ] 임시 결과 → 로그인 후 계정 귀속(마이그레이션) API

---

## 2026-03-23 — 세션 메모

> **주의:** Cursor에서 **다른 폴더를 워크스페이스 루트로 연 상태**에서 대화가 이어지면 문맥이 섞일 수 있음. Pickty 작업 시 레포 경로는 **`C:\Users\Administrator\CursorProjects\Pickty`** (GitHub: `sleep5115/Pickty`) — **이 폴더만** 열고 새 대화를 시작하는 것을 권장.

### 인프라·배포 (Lightsail / pickty.app)

- **`deploy/lightsail/nginx.conf`**: 443 SSL 종료 → 내부 `pickty-api:8080` 프록시, `X-Forwarded-*` 헤더.
- **`deploy/lightsail/docker-compose.api.yml`**: 서비스명 `pickty-api`, 호스트 **8080 미개방**, `nginx`만 `443:443`, **`SPRING_PROFILES_ACTIVE=prod`**(운영) 주석 명시. `docker compose down --remove-orphans`로 구 compose와 컨테이너명 충돌 완화.
- **로컬 배포 스크립트** `deploy-to-lightsail.sh` / `.ps1` 는 **삭제**하고 **GitHub Actions**로 통합.
- **`.github/workflows/deploy-backend.yml`**: `main` push 시만 SSH 배포. **`appleboy/ssh-action@v1.2.5`**. Secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_USERNAME`, `LIGHTSAIL_SSH_KEY`, `SSL_CERT`, `SSL_KEY`. 원격에서 `git pull origin main` + compose up `--build`.
- 서버 클론이 예전엔 **`main` 브랜치 없음**(`origin`에 `dev`만) 상태였음 → GitHub에 **`main` 생성·푸시** 후 서버에서 `git fetch` / `checkout main` 필요.
- **방화벽:** 운영은 **443 허용**, **8080 외부 차단** 권장.

### 로컬 개발 문서

- **`docs/LOCAL-DEV.md`**: 프론트 `npm run dev`(**포트 3002**), 백엔드는 시스템 `JAVA_HOME`이 JDK16 등이면 **세션만** `JAVA_HOME=C:\Users\Administrator\.jdks\corretto-25.0.2` + `SPRING_PROFILES_ACTIVE=dev` + `gradlew bootRun`. (폴더명은 **`.jdks`**, `.jdk` 아님.)
- 동 파일에 **이미지 표시(API 파일 엔드포인트·`next/image`·`dangerouslyAllowLocalIP`)** 및 R2 CORS 예시 JSON 정리됨.

### 프론트 UX·카피

- **이상형 월드컵**: 후순위 미구현 — **GNB·메인·로그인/회원가입 카피**에서 노출 제거(주석 또는 준비 중 페이지만 `/worldcup` 직접 접근).
- **카피:** 밀키트/재료 등 제거, 티어 플로우는 **「아이템」** 으로 통일(템플릿 목록·새 템플릿 등).
- **내 계정 (`dashboard`)**: 일반 유저에게 **OAuth raw / Access Token / 내부 User ID** 비노출. **`role === 'ADMIN'`** 일 때만 표시·`/oauth-raw` 호출.
- **메타데이터** (`layout.tsx`): 월드컵 문구 제거, 티어표 중심으로 정리.

### R2 이미지·표시 (정리됨, 2026-03 말)

- **과거 증상:** `img.pickty.app` 직링크 **403**·ORB 등 — 브라우저가 공개 URL만 칠 때 발생.
- **현재 방식:** **`picktyImageDisplaySrc`** (`item-card`·`static-item-card`·`/templates` 썸네일)가 DB의 `https://img.pickty.app/{key}` 를 **`{NEXT_PUBLIC_API_URL}/api/v1/images/file/{key}`** 로 치환. 백엔드 **`R2ImageStorageService.fetchStoredObjectIfPresent`** 가 S3 API **GetObject**, 응답에 **`Access-Control-Allow-Origin: *`** · 캐시 헤더. 경로 변수는 **`{key:.+}`** (`.png` 잘림 방지).
- **Next `/r2-img` rewrite:** 제거됨(의미 없는 이중 프록시).
- **로컬 템플릿 썸네일:** `next/image` → `/_next/image?url=http://localhost:8080/...` 는 **`images.dangerouslyAllowLocalIP: true`** 필요(Next 16 기본 차단 → 400).
- **버킷:** dev·prod **동일 버킷·키 평면**(`{uuid}.ext`) — 폴더/프로필 접두사 없음(분리하려면 추후 설계).

### 세션 메모 (2026-03-24)

- 위 **이미지 API 경유**·**`dangerouslyAllowLocalIP`**·PROGRESS/LOCAL-DEV 문구 동기화.
- Cursor 터미널에서 프론트·백엔드 기동 시 **JAVA_HOME**(JDK 25)·**3002/8080 포트** 충돌 여부 확인.
- 레포 문서에서 **타 프로젝트명** 언급 제거(워크스페이스 혼동 방지 문구만 유지).

### 기타

- **`frontend/README.md`**: `LOCAL-DEV.md` 링크, 로컬 URL **3002** 로 수정.
- **`PROGRESS.md` 본문** 일부(페이지 목록·GNB·Phase 체크)는 월드컵 비노출·배포 방식에 맞게 이미 손본 상태.
