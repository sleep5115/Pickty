# Pickty 진행 현황

> **역할**: 웹 AI(Gemini)·에이전트용 **진행 요약**. 예전 장문 원본은 **`progress/PROGRESS_20260327.md`** 에 보관(히스토리·N차 체크리스트·DBeaver 장문 등).  
> **에이전트**: 코드 작업 전 **이 파일(`PROGRESS.md`)을 먼저** 읽고, 세부·날짜별 맥락은 보관본 해당 절을 참고.

---

## 워크스페이스 · 문서 (고정)

- Cursor는 **`Pickty/` 레포 루트만** 연 것을 전제로 한다.
- 맥락 문서: **`.cursor/rules/pickty-project-context.mdc`**(전역) + **`PROGRESS.md`**(진행).
- 비공개 설정 형제 폴더 **`pickty-config`** — 복사 절차는 `pickty-project-context.mdc` Git 블록. 실값·비번은 gitignore 파일에만.

| 경로 | 용도 |
|------|------|
| `progress/PROGRESS_20260327.md` | 2026-03-27 이전 **전량** 진행 로그·체크리스트 보관 |
| `docs/LOCAL-DEV.md` | 로컬 실행(Windows, JDK 25, 프론트 **3002**, `dev`/`local` 프로필) |
| `docs/DEPLOYMENT-CHECKLIST.md` | OAuth·Vercel·CORS·`npm run verify:deploy` |
| `deploy/lightsail/README.md` | Lightsail·compose·시크릿 경로 |

**브랜치**: `dev` 평소 개발 · `main` 배포(직접 push 금지, `dev` PR 머지).

---

## 레포 · 스택 (요약)

- **레포**: https://github.com/sleep5115/Pickty — `frontend/`(Next 16 App Router, React 19, Tailwind v4), `backend/`(Kotlin 2.2, Spring Boot 4, Java 25).
- **로컬 DB(선택)**: `docker-compose.yml` — 호스트 **5442·6380** → Postgres 17 / Valkey 9. 루트 **`.env`** 에 `POSTGRES_PASSWORD` 만(실값 비커밋).

---

## 인프라 방향 · 스냅샷

| 구분 | 내용 |
|------|------|
| API·DB·캐시 | **AWS Lightsail** 서울 — Docker로 PostgreSQL 17 + Valkey 9 |
| 이미지 | **Cloudflare R2** (S3 API), 버킷 **`pickty-images`**, 공개 **`img.pickty.app`** (`public-url` + 객체키) |
| 프론트 | **Vercel** 등(도메인 **`pickty.app`**, API **`api.pickty.app`**) |

**DB 이름**: 클러스터 안 형제 DB — **`pickty_dev`**(개발) · **`pickty_prod`**(운영) · **`pickty`**(로컬/DBeaver 앵커 등) · 시스템 **`postgres`**. 한 연결의 초기 Database는 하나만; **Show all databases**로 트리에서 형제 확인. **`postgres`·template* DROP 금지.**

**DBeaver**: Host/Port/User/Password는 **`application-secrets.yaml`** / pickty-config. 단계별 스크린 설명은 **`progress/PROGRESS_20260327.md`** 또는 `LOCAL-DEV.md`.

---

## 전체 진행 상태 (동기화됨)

| 영역 | 상태 | 비고 |
|------|------|------|
| 개발 환경·모노레포·pickty-config | ✅ | |
| GNB·테마·기본 라우팅 | ✅ | 티어 허브 `/templates`, 월드컵은 UI 비노출 |
| Auth — 소셜·온보딩·계정·병합·탈퇴 | ✅ | Google·Kakao·Naver, `/signup/profile`, Merge·`MERGED`, `DELETE /me` |
| Auth — 세션 하드닝 **(2026-03-26)** | ✅ | Refresh **HttpOnly** 쿠키, OAuth 후 **`?exchange` → `POST /api/v1/auth/oauth-exchange`**, **`/auth/refresh`·`/auth/logout`**, Access **블랙리스트**, `credentials: 'include'` |
| Tier Maker — 보드 UX | ✅ | DnD·행 정렬·설정 모달·멀티 선택·캡처·라이트/다크·모바일 |
| Tier — 템플릿·이미지·결과 API + R2 | ✅ | `POST/GET templates`, `POST /images`→R2, `GET .../images/file/{key}`, 결과 CRUD·`/tier/my`·썸네일·동적 OG·워터마크 |
| Tier — 비회원 → 로그인/가입 **자동 저장** | ✅(1차) | `tier-store` **sessionStorage persist** + `tierAutoSaveIntent` · `post-oauth-tier-flow` · 로그인/`auth/callback`/온보딩 후 **`POST /api/v1/tiers/results`** · 미리보기 PNG **`tier-autosave-thumbnail`** 스태시→인증 후 R2 업로드(수동 저장과 동일 보드 썸네일) · `/tier` 템플릿 진입 시 intent+`templateId` 일치하면 **서버 덮어쓰기 생략** |
| 프론트 업로드 압축 | ✅(1차) | `browser-image-compression`(WebP·장변 1024 등), 순차 업로드 — **P0 수치 정합·한도 검증**은 여전히 점검 과제 |
| Ideal Type World Cup | ⬜ | **후순위** — UI 비노출, 착수 미정 |
| Tier — 장기 과제 | ⬜ | R2 **리사이즈·CDN**, 스트리머 방 **TTL/배치**, 임시 결과→계정 **귀속** 등 — **대규모 트래픽 방어**는 바로 아래 절(확정) |

### 스트리머 모드 — 대규모 트래픽 방어 (기획 확정)

- **프론트엔드 (대기열 없음)**: 503·429·지연 시 무거운 대기열 UI 대신 **가벼운 로딩 스피너**; 백그라운드에서 **1~3초 랜덤 지터(Jitter)** 후 **조용히 API 자동 재시도**.
- **백엔드 Read**: 수천 명이 같은 템플릿을 조회해도 **`GET /templates/{id}`** 결과를 Valkey에 **약 1분** 캐시해 DB 커넥션 고갈 완화.
- **백엔드 Write (휘발성 집계)**: 스트리머 모드 시청자 제출은 기본 **휘발성** — DB INSERT 없이 Valkey로 **실시간 집계만**, **TTL**로 폐기. **가입/로그인 후 명시적 「저장」** 요청 시에만 DB 영구 적재(**데이터 귀속**).

---

## 현재 제품 동작 (2026-03 후반 기준)

- **라우팅**: 랜딩 → **`/templates`** → 카드 **`/tier?templateId=`** · 새 밀키트 **`/template/new`**.
- **업로드·저장**: **`POST /api/v1/images`** → R2 `PutObject` · DB/JSON 메타는 `https://img.pickty.app/{uuid}.ext` 형(설정 `public-url`). 표시는 **`picktyImageDisplaySrc`** / **`GET /api/v1/images/file/{key}`**(CORS `*`).
- **템플릿 썸네일**: DB **`tier_templates.thumbnail_url`** 단일. 2×2 **`template-thumbnail-composite.ts`**(Canvas). 마이그레이션: `docs/migrations/2026-03-25-p1-tier-template-user.sql`.
- **티어 결과**: 저장 시 PNG·**`tier_results.thumbnail_url`** · 동적 OG **`/tier/result/[id]`** · 보드 **워터마크 `pickty.app`**.
- **내 티어표**: GNB **내 정보** → **`/tier/my`**.
- **비회원 저장→소셜**: export 모달 **「로그인하고 서버에 저장」** → 보드·intent **sessionStorage** · **ACTIVE** 즉시 결과 저장 후 **`/tier/result/[id]`** · **PENDING** 은 온보딩 후 저장·이동 · 비회원 시 **제목·설명 입력 없음**(기본 제목 등) — **나중에 `/tier/my`에서 메타 수정** 예정.
- **공유·OG**: `generateMetadata` + `fetchTierResultForOpenGraph` / `fetchTemplateForOpenGraph`. **카톡 등 크롤러용 `og:image`** 는 R2 직링크 대신 **`resolvePicktyImageUrlForOpenGraph`** 로 **`https://api.pickty.app/api/v1/images/file/{key}`** 절대 URL 사용(`pickty-image-url.ts`). UI: **`공유`** 라벨 + **`sonner`** 토스트(클립보드) — `tier-board`(템플릿 링크), `tier-result-client-page`, `export-modal` 저장 완료 화면.
- **413·순차 업로드**: Tomcat `maxPostSize` + **`TomcatMaxPostSizeCustomizer`**; **`uploadPicktyImages`** 파일별 순차 POST.
- **Next 16**: 로컬 API URL `next/image` 시 **`dangerouslyAllowLocalIP: true`**.

---

## 모바일 타겟팅 · 저장 UX **(2026-03-27)**

- **문제**: 타겟팅 중 햄버거/저장 클릭 시 React 경고(다른 컴포넌트 렌더 중 store 갱신) 방지 + “해제만 vs 바로 동작” 일관성.
- **동작**: **`targetTierId !== null` 이면**  
  - 모바일 **햄버거**·데스크톱 **내 정보**: **메뉴/드롭다운은 열지 않고** `clearTarget` + `clearSelection` 만 (`useTierStore.getState()`로 호출 — `setState` 업데이터 안에서 이벤트 dispatch 금지).  
  - **`저장 | 다운로드`**: **모달 없이** 동일 해제만. **둘째 탭**부터 모달. 타겟 중에는 버튼에 **`active:scale-95` 미적용**(눌림 없이 해제만 느낌); 타겟 없을 때만 스케일.  
  - 상단 **타겟팅 토스트**가 사라지는 것이 첫 탭 피드백으로 충분하다는 합의.
- **캡처**: **`export-modal`** `generate()` 시작 시 `clearTarget`·`clearSelection` 후 **이중 `requestAnimationFrame`** 으로 리페인트 대기 → PNG에 보라 테두리·흐림 잔상 방지.

---

## 티어 — 비회원 자동 저장 플로우 **(2026-03-27)**

- **스토어**: `useTierStore`에 **`persist`(sessionStorage, `pickty-tier-board`)** — `tiers`·`pool`·`templateId`·`tierAutoSaveIntent`·자동 저장용 제목/설명 메타. `beginTierAutoSaveFlow` / `clearTierAutoSaveIntent` · 초기화 시 썸네일 스태시도 정리(`tier-autosave-thumbnail`).
- **썸네일**: 비로그인은 업로드 불가 → 모달 **미리보기 blob URL**을 Data URL로 **`sessionStorage`**(`pickty-tier-autosave-thumb-dataurl`)에 두고, **`runPersistedTierAutoSave`** 안에서 토큰으로 업로드 후 `createTierResult.thumbnailUrl` 설정(`thumbnailUrl: null`이면 백엔드가 첫 아이템 등 폴백).
- **라우팅**: `resolvePostOAuthTierFlow` — intent 있을 때 **PENDING** → `/signup/profile`만(API 저장 안 함) · **ACTIVE** → 즉시 저장·결과 페이지 · 실패 시 intent·스태시 정리 후 기본 `returnTo` 경로 + 토스트(로그인 페이지 등).
- **온보딩**: `signup/profile` 제출 성공 직후 intent 있으면 **온보딩 PATCH 다음** `runPersistedTierAutoSave` → 성공 시 **`/tier/result/[id]`**, 아니면 `/account`.
- **템플릿 재진입**: `tier-page-client` — persist 하이드 후 **`tierAutoSaveIntent` + URL `templateId` === 스토어 `templateId`** 이면 **`getTemplate`/`loadTemplateWorkspace` 생략**(로컬 이어쓰기).
- **하이드레이션**: `use-tier-persist-hydrated` — 템플릿 로드 effect가 persist 복원 전에 도는 것 방지.
- **메모**: 구글 프로필 이미지 `lh3.googleusercontent.com` **429** 는 CDN 레이트리밋 가능성 — 코드 이슈 아님, 재시도·캐시·(장기) 아바타 자체 호스팅 검토.

---

## OAuth · 로그인 흐름 (현행)

1. **`/login`** → `{API}/oauth2/authorization/{provider}` (팝업 또는 동일 탭).
2. 성공 시 Refresh **HttpOnly** 쿠키, **`/auth/callback?exchange=…`** → **`POST /api/v1/auth/oauth-exchange`** 로 Access JSON.
3. **`apiFetch`**: `credentials: 'include'` · 401 시 **`/auth/refresh`** · 로그아웃 **`POST /auth/logout`**.

---

## 기획 요약 (MVP ~ 확장)

- **Auth (확정)**: **소셜 전용** — 자체 이메일 가입/로그인 없음. 보관본 MVP 표의 이메일 문구는 기획 정리 시 삭제·수정 대상.
- **로드맵**: P0 수치 정합 · P1 OG/워터마크 **완료** · P2 커뮤니티 · P3 게시판·스트리머 — 상세는 보관본 **기획·아키텍처** 절.

---

## Phase 체크리스트 (요약)

### Phase 1 — 뼈대
- [x] 소셜 OAuth · GNB · `/templates`·`/tier` · 월드컵 UI 비노출
- [x] 로그아웃 — Refresh 무효화·블랙리스트(2026-03-26)

### Phase 2 — 기획
- [x] Tier Maker 화면·백엔드 스펙·R2 (구현 기준 확정)
- [ ] World Cup — 후순위
- [ ] 스트리머 모드 범위
- [ ] **P2 커뮤니티·소셜** — 아래 「커뮤니티 확장 (P2 로드맵)」세부 기획(확정)

### 커뮤니티 확장 (P2 로드맵) — 소셜/커뮤니티 세부 기획 (확정)

- **지표 (조회수·평가 분리)**  
  - **템플릿**: **좋아요(Like)** 단일 버튼.  
  - **개별 결과 티어표**: **추천/비추천(Up/Downvote)**.  
  - **조회수**: 실시간 DB 갱신 대신 Valkey에 모았다가 **주기적 배치(Batch)** 로 DB 반영.

- **댓글 (모바일·익명)**  
  - **뎁스**: 무한 계단형 대신 **1단 + `@닉네임` 멘션** (유튜브/인스타류 UX).  
  - **알림**: 멘션 대상 유저에게 알림 → 재방문·키배 유도.  
  - **비회원**: 작성 허용 — **닉네임 + 짧은 비밀번호 + IP 해시** 저장으로 관리.

- **통계·전시 (참여 유도)**  
  - **평균 티어표**: 다수 유저 배치를 취합해 “사람들은 주로 어디에 뒀을까?”를 보여주는 **집계 티어표**.  
  - **인기(대표) 티어표**: 추천 상위 **Top 1~3** 결과를 템플릿 하단·댓글 상단 **가로 슬라이더**로 고정 노출.

### Phase 3 — 구현
- [x] 티어 템플릿·이미지·결과·프론트(R2)
- [ ] World Cup — 후순위
- [ ] 스트리머 모드

### Phase 4 — Auth · 운영
- [x] Kakao·Naver · 소셜 전용 정책 · Refresh/로그아웃 · Lightsail+GHA 배포 뼈대
- [ ] Vercel/env·도메인 점검 지속 (`DEPLOYMENT-CHECKLIST`)

### Phase 5 — Ops
- [ ] 백업·모니터링·스케일아웃 — MVP 이후
- [ ] **Docker 재시작 정책 최적화:** `docker-compose.yml`의 백엔드(`api`) 컨테이너 재시작 정책을 `restart: unless-stopped`로 설정하여 의도치 않은 OOM 종료 시에만 자동 복구되도록 구성.
- [ ] **장애 모니터링 및 알림 구축:** UptimeRobot 등을 활용해 외곽에서 API 헬스체크(`/actuator/health` 등)를 5분 주기로 찌르고, 서버가 뻗거나 응답이 없을 경우에만 **디스코드(Discord) 웹훅**으로 알림을 발송하도록 세팅 (정상 배포 시의 불필요한 알림 방지).

---

## 다음 작업 (우선순위)

1. 티어: 템플릿 역할 정리, 임시→계정 귀속, 스트리머 TTL 등 · **`/tier/my`에서 결과 제목·설명(및 필요 시 썸네일) 수정** — 비회원 자동 저장은 현재 기본 제목 위주.
2. P0: 압축·한도·프록시 수치 정합.
3. World Cup / P2: 후순위.

---

## 배포 · 운영

- nginx 443 → API. **`~/Pickty/deploy/lightsail/application-secrets.yaml`** 필수.
- `img.pickty.app` **403** vs API **404** 진단은 보관본 R2 절 또는 `LOCAL-DEV.md`.

---

## 마이그레이션·코드 맵

| 파일 | 메모 |
|------|------|
| `docs/migrations/2026-03-25-p1-tier-template-user.sql` | P1 썸네일 |
| `docs/migrations/2026-03-26-users-merged-into-user-id.sql` | 병합 |
| `frontend/src/lib/pickty-image-url.ts` | `resolvePicktyImageUrlForOpenGraph`, 표시용 URL |
| `frontend/src/lib/tier-result-opengraph.ts`, `template-opengraph.ts` | OG fetch |
| `frontend/src/components/tier/tier-board.tsx`, `export-modal.tsx` | 타겟팅·캡처·공유·비회원 자동 저장 CTA |
| `frontend/src/lib/store/tier-store.ts` | Zustand + **sessionStorage persist**, `tierAutoSaveIntent` |
| `frontend/src/lib/post-oauth-tier-flow.ts`, `tier-autosave-thumbnail.ts` | OAuth/온보딩 후 자동 저장·썸네일 스태시 |
| `frontend/src/lib/hooks/use-tier-persist-hydrated.ts` | 티어 persist 하이드 대기 |
| `frontend/src/app/tier/tier-page-client.tsx` | intent 시 템플릿 API 덮어쓰기 방지 |
| `frontend/src/app/login/page.tsx`, `auth/callback/page.tsx`, `signup/profile/page.tsx` | `resolvePostOAuthTierFlow` 연동 |
| `frontend/src/components/layout/gnb.tsx` | 모바일/내 정보 + 타겟 시 1차 클릭 해제 |
| `backend/.../domain/tier/`, `upload/` | 템플릿·결과·R2·`ImageUploadController` |

**구현 세부**(DnD N차 등)는 **`progress/PROGRESS_20260327.md`** 참고.

---

## 알려진 이슈 · 메모

- `next-themes` + React 19 콘솔 경고 — 라이브러리 한계.
- 워크스페이스는 **`Pickty/` 루트**만 열 것.
- 스트리머 모드 **대규모 트래픽 방어** 요지는 **「전체 진행 상태」표 직후 절**에 정리됨(구현 전 기획 확정분).
