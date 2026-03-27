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

### Phase 3 — 구현
- [x] 티어 템플릿·이미지·결과·프론트(R2)
- [ ] World Cup — 후순위
- [ ] 스트리머 모드

### Phase 4 — Auth · 운영
- [x] Kakao·Naver · 소셜 전용 정책 · Refresh/로그아웃 · Lightsail+GHA 배포 뼈대
- [ ] Vercel/env·도메인 점검 지속 (`DEPLOYMENT-CHECKLIST`)

### Phase 5 — Ops
- [ ] 백업·모니터링·스케일아웃 — MVP 이후

---

## 다음 작업 (우선순위)

1. 티어: 템플릿 역할 정리, 임시→계정 귀속, 스트리머 TTL 등.
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
| `frontend/src/components/tier/tier-board.tsx`, `export-modal.tsx` | 타겟팅·캡처·공유 |
| `frontend/src/components/layout/gnb.tsx` | 모바일/내 정보 + 타겟 시 1차 클릭 해제 |
| `backend/.../domain/tier/`, `upload/` | 템플릿·결과·R2·`ImageUploadController` |

**구현 세부**(DnD N차 등)는 **`progress/PROGRESS_20260327.md`** 참고.

---

## 알려진 이슈 · 메모

- `next-themes` + React 19 콘솔 경고 — 라이브러리 한계.
- 워크스페이스는 **`Pickty/` 루트**만 열 것.
- 스트리머 모드 **대규모 트래픽 방어** 요지는 **「전체 진행 상태」표 직후 절**에 정리됨(구현 전 기획 확정분).
