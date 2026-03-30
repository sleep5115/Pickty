# Pickty 진행 현황

> **역할**: 웹 AI(Gemini)·에이전트용 **진행 요약**. 예전 장문 원본은 `**progress/PROGRESS_20260327.md`** · **`progress/PROGRESS_20260329.md`** · **`progress/PROGRESS_20260330.md`** 등에 보관.  
> **에이전트**: 코드 작업 전 **이 파일(`PROGRESS.md`)을 먼저** 읽고, 세부·날짜별 맥락은 보관본 해당 절을 참고.  
> **보관·다이어트**: `progress/`로 옮기거나 정본을 요약본으로 **교체**하는 일은 **사용자가 명시적으로 지시한 경우에만** — 에이전트가 길이만 보고 임의로 나누지 않음(절차: `pickty-project-context.mdc` 「진행 현황 파일 관리」).

---

## 워크스페이스 · 문서 (고정)

- Cursor는 `**Pickty/` 레포 루트만** 연 것을 전제로 한다.
- 맥락 문서: `**.cursor/rules/pickty-project-context.mdc`**(전역) + `**.cursor/rules/pickty-workflow-terms.mdc`**(기록·커밋·배포 용어·커밋 한글) + `**PROGRESS.md**`(진행).
- 비공개 설정 형제 폴더 `**pickty-config**` — 복사 절차는 `pickty-project-context.mdc` Git 블록. 실값·비번은 gitignore 파일에만.


| 경로                              | 용도                                                      |
| ------------------------------- | ------------------------------------------------------- |
| `progress/PROGRESS_20260327.md` | 2026-03-27 이전 **전량** 진행 로그·체크리스트 보관                     |
| `progress/PROGRESS_20260329.md` | 2026-03-29 **검증 정합·템플릿 UGC(소프트삭제·PATCH 메타·파생)·목록 UI** 요약 보관 |
| `progress/PROGRESS_20260330.md` | 2026-03-30 **법무 웹 노출·탈퇴 모달·약관 명칭(서비스 제공자)** 등 보관 |
| `docs/LOCAL-DEV.md`             | 로컬 실행(Windows, JDK 25, 프론트 **3002**, `dev`/`local` 프로필) |
| `docs/DEPLOYMENT-CHECKLIST.md`  | OAuth·Vercel·CORS·`npm run verify:deploy`               |
| `deploy/lightsail/README.md`    | Lightsail·compose·시크릿 경로                                |


**브랜치**: `dev` 평소 개발 · `main` 배포(직접 push 금지, `dev` PR 머지).

---

## 레포 · 스택 (요약)

- **레포**: [https://github.com/sleep5115/Pickty](https://github.com/sleep5115/Pickty) — `frontend/`(Next 16 App Router, React 19, Tailwind v4), `backend/`(Kotlin 2.2, Spring Boot 4, Java 25).
- **로컬 DB(선택)**: `docker-compose.yml` — 호스트 **5442·6380** → Postgres 17 / Valkey 9. 루트 `**.env**` 에 `POSTGRES_PASSWORD` 만(실값 비커밋).

---

## 제품 용어 (템플릿 vs 결과) **(2026-03-30)**

| 내부 호칭 | 의미 | DB 테이블 |
|-----------|------|-----------|
| **템플릿 (Template)** | 아이템만 나열된 **기본 판**(유저가 말하는 「포켓몬 티어표」 **밀키트** 형태로 올리는 원본). 티어 메이커에서 S/A/B 등에 **배치하기 전**의 재료 집합. | **`tier_templates`** — 소프트 삭제 컬럼 **`template_status`** (`ACTIVE` \| `DELETED`). |
| **결과 / 결과표 (Tier Result)** | 유저가 템플릿 아이템을 티어 행(S, A, B …)과 풀에 **배치한 뒤 저장한 최종 스냅샷**. | **`tier_results`** — `template_id` 참조 · 소프트 삭제 **`result_status`** (`ACTIVE` \| `DELETED`), 삭제 시 **`is_public` false** · 피드·**내 티어표 API** 모두 목록은 **`ACTIVE`만**(유저 입장에선 삭제와 동일). 마이그레이션 본편: **`docs/migrations/2026-03-30-tier-results-result-status-soft-delete.sql`**. |

**계정 상태**와 구분: 유저는 **`users.account_status`** (`AccountStatus`), 템플릿은 **`template_status`** (`TemplateStatus`).

---

## 인프라 방향 · 스냅샷


| 구분        | 내용                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------ |
| API·DB·캐시 | **AWS Lightsail** 서울 — Docker로 PostgreSQL 17 + Valkey 9                                          |
| 이미지       | **Cloudflare R2** (S3 API), 버킷 `**pickty-images**`, 공개 `**img.pickty.app**` · **(2026-03-31)** API `GET .../images/file`·Next `minimumCacheTTL`·배포 문서 **3.5** · **(2026-03-30)** 대시보드 Cache Rule(Edge/Browser TTL 1년) 후 **`curl` 검증**: `cf-cache-status` **MISS→HIT**, `Cache-Control` **immutable** 유지 |
| 프론트       | **Vercel** 등(도메인 `**pickty.app**`, API `**api.pickty.app**`)                                     |


**DB 이름**: 클러스터 안 형제 DB — `**pickty_dev**`(개발) · `**pickty_prod**`(운영) · `**pickty**`(로컬/DBeaver 앵커 등) · 시스템 `**postgres**`. 한 연결의 초기 Database는 하나만; **Show all databases**로 트리에서 형제 확인. `*postgres`·template DROP 금지.**

**DBeaver**: Host/Port/User/Password는 `**application-secrets.yaml`** / pickty-config. 단계별 스크린 설명은 `**progress/PROGRESS_20260327.md**` 또는 `LOCAL-DEV.md`.

---

## 전체 진행 상태 (동기화됨)


| 영역                             | 상태    | 비고                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 개발 환경·모노레포·pickty-config       | ✅     |                                                                                                                                                                                                                                                                                            |
| GNB·테마·기본 라우팅                  | ✅     | 티어 허브 **`/templates`**(라벨 **「템플릿」**), **`/tier/feed`**(라벨 **「티어표」**), 월드컵은 UI 비노출 · **(2026-03-28)** 명칭 정리 · **(2026-03-30)** 전역 **`SiteFooter`** — 이용약관(`**/terms`**), 개인정보처리방침(`**/privacy`**), 문의 메일 · **(2026-03-30)** 계정 드롭다운 **내 템플릿** `**/templates/mine`** — 상단 **티어표** 탭은 **`/tier/feed`** 유지                                                                                                                                                                                                                                                            |
| Auth — 소셜·온보딩·계정·병합·탈퇴         | ✅     | Google·Kakao·Naver, `/signup/profile`, Merge·`MERGED`, `DELETE /me` · **(2026-03-30)** 탈퇴 확인 모달: 개인정보 즉시 파기·**서비스에 게시·작성한 모든 콘텐츠**는 탈퇴 후 수정·삭제 불가(월드컵·게시판 등 확장 대비 포괄 문구) · 소셜 로그인 하단 **이용약관·개인정보처리방침** 동의 안내 링크                                                                                                                                                                                                                        |
| Auth — 세션 하드닝 **(2026-03-26)** | ✅     | Refresh **HttpOnly** 쿠키, OAuth 후 `**?exchange` → `POST /api/v1/auth/oauth-exchange`**, `**/auth/refresh`·`/auth/logout**`, Access **블랙리스트**, `credentials: 'include'`                                                                                                                      |
| Tier Maker — 보드 UX             | ✅     | DnD·행 정렬·설정 모달·멀티 선택·캡처·라이트/다크·모바일                                                                                                                                                                                                                                                         |
| Tier — 템플릿·이미지·결과 API + R2     | ✅     | `POST/GET templates`, **`GET /templates/mine`**(인증·본인 `creator_id`·`ACTIVE`만) **`/templates/mine`** 페이지 · **`PATCH/DELETE /templates/{id}`** **(2026-03-29)** — 메타만 PATCH·**소프트 삭제**(`template_status`/`@ColumnDefault('ACTIVE')`)·목록은 ACTIVE만·단건 GET은 삭제 포함 · **`forkTemplateId`** 파생 · `POST /images`→R2 등 나머지 동일 · **(2026-03-28)** 결과 `PATCH`/`DELETE`·피드·리믹스·**`/tier/feed`** · **(2026-03-30)** DB `status`→`template_status`, 파생·결과 저장 시 삭제된 템플릿 차단 · **티어 결과** `DELETE`는 **소프트**(`result_status`·비공개)·**피드·내 티어표 목록** 모두 `ACTIVE`만                                                                                                                                                                                    |
| Tier — 비회원 → 로그인/가입 **자동 저장**  | ✅(1차) | `tier-store` **sessionStorage persist** + `tierAutoSaveIntent` · `post-oauth-tier-flow` · 로그인/`auth/callback`/온보딩 후 `**POST /api/v1/tiers/results`** · 미리보기 PNG `**tier-autosave-thumbnail**` 스태시→인증 후 R2 업로드(수동 저장과 동일 보드 썸네일) · `/tier` 템플릿 진입 시 intent+`templateId` 일치하면 **서버 덮어쓰기 생략** |
| 프론트 업로드 압축·한도 동기화              | ✅     | `uploadPicktyImages` **파일당 순차 POST**(벌크 아님) · `browser-image-compression` WebP·장변 1024·목표 **~0.5MB** — **Nginx·Spring multipart·Tomcat 요청당 8MB** 통일 **(2026-03-30)** · `pickty-upload-hint.ts` UI 안내                                                                                                                                                                                                        |
| Ideal Type World Cup           | ⬜     | **최후순위** — 티어 코어가 거의 마무리된 뒤 착수. UI 비노출, 착수 미정. **스트리머 모드보다 뒤.**                                                                                                                                                                                                                                                                    |
| Tier — 장기 과제 (일반)            | ✅(1차) | **이미 함**: 업로드 전 브라우저 압축. **(2026-03-31 1차 완료)**: `GET .../images/file/**` **`Cache-Control: public, max-age=31536000, immutable`** · **`next.config.ts`** `images.minimumCacheTTL` **31536000** · **`docs/DEPLOYMENT-CHECKLIST.md`** 「3.5 Cloudflare R2 및 CDN 캐시」. **(2026-03-30) 운영 검증**: `api.pickty.app` 프록시 경로에 대해 **`curl.exe -sI`** 2연속 → **`cf-cache-status` MISS then HIT**. **추후(선택)**: R2 `PutObject` **Cache-Control** 메타·**파생 해상도**·Cloudflare Images 등(트래픽·비용 보고 후).                                                                                                                                                                                                                                        |
| 스트리머 모드 + 대규모 트래픽 방어        | ⬜     | **최후순위 축** — 대부분의 코어 기능 구현이 끝난 뒤 추가. Valkey 휘발성 쓰기·TTL·명시적 저장 시 DB **귀속** 등은 **이 기능 전제**(비회원 `sessionStorage` 자동 저장 ✅ 과 별개). **월드컵보다 앞.** 기획 요지는 바로 아래 절(확정).                                                                                                                                                                                        |
| **P2 커뮤니티 — 반응·댓글 (1차)** **(2026-03-30)** | ✅(1차) | 다형성 `reactions`·`comments` + `tier_templates`/`tier_results` 역정규화 카운트. API: `POST /api/v1/community/reactions/toggle`(회원·비회원 IP 해시), 댓글 CRUD·페이지 `GET`·`DELETE`(비회원 비번). 프론트: `community-api`·`TemplateLikeButton`·`ResultVoteButtons`(낙관적 UI)·`CommentSection` — `/templates`·`/tier`·`/tier/feed`·`/tier/result/[id]` 연동. 마이그레이션 **`docs/migrations/2026-03-31-p2-community-unified.sql`** · **(2026-03-30) 새로고침 후 하이라이트 유지**: 로그인 시 템플릿/결과 GET 응답 **`myReaction`** + `ReactionRepository` **IN** bulk(`CommunityMyReactionService`) · 비회원은 **`reaction-store`**(`localStorage`) · **선택 상태 색**: 좋아요 **핑크**·추천 **빨강**·비추천 **파랑** · **회원+IP 하이브리드**: `guest_ip_hash`·부분 유니크(`user_id IS NULL`만) — **`docs/migrations/2026-03-30-reactions-member-ip-hash-hybrid.sql`**. · **남음**: 집계 티어·조회수 배치 등 기획 절 확장분. |


### 스트리머 모드 — 대규모 트래픽 방어 (기획 확정 · 구현은 후순위)

- **착수 시점**: 코어 티어·주요 기능 마무리 후. 로드맵상 **월드컵보다 앞**, 둘 다 **최후순위** 축(위 표 참고).
- **프론트엔드 (대기열 없음)**: 503·429·지연 시 무거운 대기열 UI 대신 **가벼운 로딩 스피너**; 백그라운드에서 **1~3초 랜덤 지터(Jitter)** 후 **조용히 API 자동 재시도**.
- **백엔드 Read**: 수천 명이 같은 템플릿을 조회해도 `**GET /templates/{id}`** 결과를 Valkey에 **약 1분** 캐시해 DB 커넥션 고갈 완화.
- **백엔드 Write (휘발성 집계)**: 스트리머 모드 시청자 제출은 기본 **휘발성** — DB INSERT 없이 Valkey로 **실시간 집계만**, **TTL**로 폐기. **가입/로그인 후 명시적 「저장」** 요청 시에만 DB 영구 적재(**데이터 귀속**).

---

## 현재 제품 동작 (2026-03 후반 기준)

- **라우팅**: 랜딩 → `**/templates`** → 카드 `**/tier?templateId=**` · 새 밀키트 `**/template/new**` · 템플릿 **제목/설명 수정**은 **모달**(목록·`/tier` 헤더 케밥) + **`PATCH /templates/{id}`** · **파생** `**/template/new?forkTemplateId=`**(`parentTemplateId` 기록) · **(2026-03-30)** 정적 **`/terms`** · **`/privacy`**(마크다운 렌더), 푸터·로그인 동의 링크.
- **업로드·저장**: `**POST /api/v1/images`** → R2 `PutObject` · DB/JSON 메타는 `https://img.pickty.app/{uuid}.ext` 형(설정 `public-url`). 표시는 `**picktyImageDisplaySrc**` / `**GET /api/v1/images/file/{key}**`(CORS `*`) — **(2026-03-31)** 해당 GET 응답 **`Cache-Control: public, max-age=31536000, immutable`** · Next `**next/image**` 원격 최소 캐시 **`minimumCacheTTL: 31536000`** (`next.config.ts`). **(2026-03-30)** Cloudflare Cache Rule 적용 후 동 경로에 **`curl -sI`** 2회 시 **`Server: cloudflare`**, **`cf-cache-status`**: 첫 **`MISS`**·둘째 **`HIT`** (엣지 캐시 동작 확인). 키 샘플은 공개 **`GET /api/v1/templates`** 의 **`thumbnailUrl`** 파일명 부분 사용 가능.
- **템플릿 썸네일**: DB `**tier_templates.thumbnail_url`** 단일. 2×2 `**template-thumbnail-composite.ts**`(Canvas). 마이그레이션: `docs/migrations/2026-03-25-p1-tier-template-user.sql`.
- **티어 결과**: 저장 시 PNG·`**tier_results.thumbnail_url`** · 동적 OG `**/tier/result/[id]**` · **`pickty.app`** 워터마크는 **PNG 다운로드 시에만**(`tier-capture-png` `includeWatermark`) — 편집 화면·보내기 모달 **미리보기**·서버 썸네일에는 비포함 **(2026-03-28)**.
- **내 티어표**: GNB **내 정보** → `**/tier/my`** · `GET .../tiers/results/mine` **ACTIVE만**(삭제한 건 목록에서 제외, 직접 URL·OG는 유지) · 카드 **수정/삭제/리믹스**.
- **내 템플릿**: GNB **내 정보** → `**/templates/mine`**(로그인) · `GET /api/v1/templates/mine` — 본인이 만든 **ACTIVE** 템플릿만 · 카드는 전체 목록과 동일(티어 만들기·좋아요·수정/삭제). **`frontend/src/components/template/template-card.tsx`** 공통.
- **글로벌 피드**: `**/tier/feed`** — `GET /api/v1/tiers/results` **ACTIVE만** **무한 스크롤** · 카드 권한: **수정=본인만**, **삭제=본인 또는 ADMIN**, **리믹스=항상** · **(2026-03-30)** 카드에 **추천/비추천**(낙관적 UI).
- **P2 커뮤니티 (1차)**: 템플릿 **좋아요**(`/templates` 카드·`/tier`는 **`tier-board`** 저장\|다운로드 줄 **왼쪽** **(2026-03-30)**), 결과 **추천/비추천**(피드·결과 상세), **통합 댓글**(`/tier`·`/tier/result/[id]` 하단). 비회원 댓글은 닉네임(선택)·비번(필수)·표시 `익명 (IP 앞 두 마디)`; API는 `**/api/v1/community/**`**. 반응 UI는 **새로고침 후에도 유지** — 회원: 목록·상세 GET의 **`myReaction`**(JWT 시 bulk 조회); 비회원: **`pickty.community.reactions.v1`** `localStorage` · 버튼 **선택 색**: 좋아요 **핑크**·추천 **빨강**·비추천 **파랑**.
- **비회원 저장→소셜**: export 모달 **「로그인하고 서버에 저장」** → 보드·intent **sessionStorage** · **ACTIVE** 즉시 결과 저장 후 `**/tier/result/[id]`** · **PENDING** 은 온보딩 후 저장·이동 · 비회원 시 **제목·설명 입력 없음**(기본 제목 등) — **메타 수정**은 `/tier/my`·결과 상세·피드 카드에서 가능.
- **공유·OG**: `generateMetadata` + `fetchTierResultForOpenGraph` / `fetchTemplateForOpenGraph`. **카톡 등 크롤러용 `og:image`** 는 R2 직링크 대신 `**resolvePicktyImageUrlForOpenGraph**` 로 `**https://api.pickty.app/api/v1/images/file/{key}**` 절대 URL 사용(`pickty-image-url.ts`). UI: `**sonner**` 토스트(클립보드) — `tier-page-client`(템플릿 링크), `tier-result-client-page`, `export-modal` 저장 완료 화면.
- **이미지 업로드 한도**: `**uploadPicktyImages**` — 압축 후 **파일마다 별도 `POST /api/v1/images`**(순차, 단일 `files` 파트). **8MB** — `**deploy/lightsail/nginx.conf`** `client_max_body_size` · `**application.yaml`** `spring.servlet.multipart` + `server.tomcat` · `**TomcatMaxPostSizeCustomizer**` 동일. 브라우저 쪽 목표는 **~0.5MB/장**(장변 1024 WebP).
- **Next 16**: 로컬 API URL `next/image` 시 `**dangerouslyAllowLocalIP: true`**.

---

## 티어 메이커 · GNB · 캡처 **(2026-03-28)**

- **GNB**: 첫 탭 **「템플릿」**(`/templates`), 둘째 **「티어표」**(`/tier/feed`). **내 정보** 드롭다운: **내 계정**·**내 티어표**·**내 템플릿** (`/templates/mine`)·로그아웃 — **(2026-03-30)** 예전 드롭다운의 공개 피드 단축 링크는 **내 템플릿**으로 대체(피드는 상단 **티어표** 탭). 피드·내 티어표 페이지 제목/링크에서 「최신 피드」→「티어표」.
- **피드·내 티어표 카드**(`tier-result-card`): 수정·삭제를 **세로 점 3개(⋮, `MoreVertical`)** 드롭다운으로 통일(결과 상세와 동일 패턴). **(2026-03-29)** 카드 `overflow-hidden` 제거·메뉴 `z-[100]` 로 클립 방지.
- **`/tier` 상단**: 스토어 `workspaceTemplateTitle` / `workspaceTemplateDescription` — **템플릿 제목·설명**·(권한 시) **케밥**·**🔗 템플릿 공유**·PC/터치·초기화. **파생(새 템플릿 만들기)** 링크는 **`tier-board`**의 **저장\|다운로드** 줄 **왼쪽** **(2026-03-29)**. **템플릿 좋아요**는 제목 옆이 아니라 같은 줄에서 **저장\|다운로드 버튼 왼쪽**(`templateLikeSlot`) **(2026-03-30)**. **타겟팅·단축키·일괄 이동** 안내 문구는 **티어 행(`captureRef`) 바로 아래** — PNG·저장용 캡처에는 **미포함**; 페이지 하단 전용 푸터는 제거 **(2026-03-30)**. 크롬 줄(`zinc-950`)과 한 덩어리로 표 판(`zinc-900`)과 시각 분리.
- **워터마크**: 라이브 보드·export 미리보기 **비표시**; **이미지 다운로드**(export 모달·`/tier/result` PNG)에만 삽입. 글자 크기 티어 라벨 **`text-2xl` 급**.
- **에이전트 규칙**: `**.cursor/rules/pickty-workflow-terms.mdc`** — **기록**=`PROGRESS.md` 갱신, **커밋**=Pickty `dev` + pickty-config `main`, **배포**=Pickty `dev` push·`main` 머지 + pickty-config `main` push; **커밋 로그 본문 한글**.

---

## 템플릿 UGC·검증·목록 UI **(2026-03-29)**

- **백엔드**: 템플릿 **`TemplateStatus`** 컬럼명 **`template_status`**, 목록 **`ACTIVE`만**, **`DELETE` 소프트**(409·하드 삭제 폐기), **`PATCH .../templates/{id}`** — `UpdateTemplateMetaRequest`(제목·설명만, 아이템 불변). **`GET /templates/{id}`** 는 삭제된 템플릿도 반환(결과·OG 정합). `SecurityConfig` **PATCH** 허용. 제목·설명·아이템명 등 길이 **100 / 10000** 계열 정합. DB: **`@ColumnDefault('ACTIVE')`** + **`docs/migrations/2026-03-29-tier-templates-status-default.sql`** → 컬럼명 정리 **`docs/migrations/2026-03-30-rename-status-columns.sql`**. **(2026-03-30)** 소유자만 PATCH/DELETE·삭제된 템플릿을 **새 파생·새 결과 저장** 소스로 쓰지 못하게 **410 Gone** 처리.
- **프론트**: `template-edit-meta-modal` · `/templates` 케밥→모달 · `/tier` 헤더 케밥·**「이 템플릿을 바탕으로 새 템플릿 만들기」**는 **`tier-board`** 저장\|다운로드 줄 **왼쪽** · 삭제 확인 문구(소프트) · `export-modal` 등 **maxLength·한도 100/10000** 정리.
- **`/templates` 카드**: 설명 영역 **두 줄 분량 고정 높이**·푸터 **`h-11`** 로 줄 높이 고정.
- **다음 작업(예정)**: 위 **파생(복제) 버튼**의 **카피·시각·문구 등 디테일** 손보기.
- **보관**: `**progress/PROGRESS_20260329.md**`.

---

## 티어 결과 소프트 삭제·마이그레이션·공통 정책 **(2026-03-30)**

- **백엔드**: `ResultStatus` · `TierResult.result_status`. **`DELETE /api/v1/tiers/results/{id}`** 는 **`DELETE FROM` 없음** — `markDeleted()`로 `DELETED` + **`is_public = false`**. **`GET .../tiers/results`**(피드)·**`GET .../tiers/results/mine`**(내 티어표) 모두 **`ACTIVE`만** 반환; 삭제 후에도 **단건 `GET .../{id}`**·직접 URL·OG는 유지. 저장소: `findByUserIdAndResultStatusWithTemplateOrderByCreatedAtDesc` 등.
- **프론트**: `tier-api` `resultStatus` 파싱·응답 타입 · `tier-result-card` / **`/tier/result/[id]`** 삭제·삭제됨 표시 · **`tier-result-delete-confirm-dialog`** 문구(소프트·비공개·피드 숨김, 링크 유지). 삭제 성공 시 상세는 **`reloadResult`** 로 상태 반영.
- **마이그레이션 역할**: **`2026-03-30-rename-status-columns.sql`** 의 `tier_results` 블록은 **`status` 컬럼이 있을 때만** `result_status`로 RENAME — 원래 `status` 없던 DB는 **아무 컬럼도 안 생김**. 컬럼 **추가**는 **`2026-03-30-tier-results-result-status-soft-delete.sql`** (`ADD COLUMN IF NOT EXISTS`). 로컬은 **`ddl-auto: update`** 로 기동 시 컬럼이 생길 수 있어 DBeaver와 타이밍이 어긋날 수 있음.
- **공통 정책(에이전트·구현 참고)**: `**.cursor/rules/pickty-project-context.mdc`** — **「UGC·리소스 수정·삭제 정책」** — **수정**은 **본인만**(화면마다 수정 가능 필드 범위는 다를 수 있음) · **삭제**는 **본인 + `ROLE_ADMIN`** · 문맥상 **「삭제」** 기본 = **소프트 삭제** + **비공개** + **DB 레코드 유지**; 하드 삭제는 명시 시에만.

---

## 법무 웹 노출 · 약관 명칭 · 탈퇴 고지 **(2026-03-30)**

- **저장소 원문**: 루트 **`TERMS_OF_SERVICE_KO.md`** · **`PRIVACY_POLICY_KO.md`** — 법적 주체 표현 **`「서비스 제공자」`**(인디 운영 맞춤), 금지 행위 등 일부 **`픽티`** 병기.
- **프론트 빌드용 사본**: **`frontend/content/legal/*.md`** — `**read-legal-doc.ts**` 가 읽음(Turbopack 추적 범위). 루트만 고친 뒤 **`npm run sync:legal`**(`scripts/sync-legal-docs.mjs`)으로 동기화. 공개 렌더 시 **`### (내부 참고)`** 이하 제거.
- **페이지**: **`/terms`** · **`/privacy`** — Server Component + **`react-markdown`** · **`remark-gfm`** · **`@tailwindcss/typography`**(`globals.css` `@plugin`).
- **링크**: 레이아웃 **`SiteFooter`**, **`/login`** 소셜 버튼 아래 동의 문구.
- **탈퇴 UX**: **`/account`** 회원 탈퇴 모달 — 개인정보 즉시 파기·**「서비스에 게시·작성하신 모든 콘텐츠」** 탈퇴 후 수정·삭제 불가·탈퇴 전 직접 삭제 안내 · 계정·연동 정보 복구 불가 한 줄.
- **보관**: **`progress/PROGRESS_20260330.md`**.

---

## 모바일 타겟팅 · 저장 UX **(2026-03-27)**

- **문제**: 타겟팅 중 햄버거/저장 클릭 시 React 경고(다른 컴포넌트 렌더 중 store 갱신) 방지 + “해제만 vs 바로 동작” 일관성.
- **동작**: `**targetTierId !== null` 이면**  
  - 모바일 **햄버거**·데스크톱 **내 정보**: **메뉴/드롭다운은 열지 않고** `clearTarget` + `clearSelection` 만 (`useTierStore.getState()`로 호출 — `setState` 업데이터 안에서 이벤트 dispatch 금지).  
  - `**저장 | 다운로드`**: **모달 없이** 동일 해제만. **둘째 탭**부터 모달. 타겟 중에는 버튼에 `**active:scale-95` 미적용**(눌림 없이 해제만 느낌); 타겟 없을 때만 스케일.  
  - 상단 **타겟팅 토스트**가 사라지는 것이 첫 탭 피드백으로 충분하다는 합의.
- **캡처**: `**export-modal`** `generate()` 시작 시 `clearTarget`·`clearSelection` 후 **이중 `requestAnimationFrame`** 으로 리페인트 대기 → PNG에 보라 테두리·흐림 잔상 방지.

---

## 티어 — 비회원 자동 저장 플로우 **(2026-03-27)**

- **스토어**: `useTierStore`에 `**persist`(sessionStorage, `pickty-tier-board`)** — `tiers`·`pool`·`templateId`·`tierAutoSaveIntent`·자동 저장용 제목/설명 메타. `beginTierAutoSaveFlow` / `clearTierAutoSaveIntent` · 초기화 시 썸네일 스태시도 정리(`tier-autosave-thumbnail`).
- **썸네일**: 비로그인은 업로드 불가 → 모달 **미리보기 blob URL**을 Data URL로 `**sessionStorage`**(`pickty-tier-autosave-thumb-dataurl`)에 두고, `**runPersistedTierAutoSave**` 안에서 토큰으로 업로드 후 `createTierResult.thumbnailUrl` 설정(`thumbnailUrl: null`이면 백엔드가 첫 아이템 등 폴백).
- **라우팅**: `resolvePostOAuthTierFlow` — intent 있을 때 **PENDING** → `/signup/profile`만(API 저장 안 함) · **ACTIVE** → 즉시 저장·결과 페이지 · 실패 시 intent·스태시 정리 후 기본 `returnTo` 경로 + 토스트(로그인 페이지 등).
- **온보딩**: `signup/profile` 제출 성공 직후 intent 있으면 **온보딩 PATCH 다음** `runPersistedTierAutoSave` → 성공 시 `**/tier/result/[id]`**, 아니면 `/account`.
- **템플릿 재진입**: `tier-page-client` — persist 하이드 후 `**tierAutoSaveIntent` + URL `templateId` === 스토어 `templateId`** 이면 `**getTemplate`/`loadTemplateWorkspace` 생략**(로컬 이어쓰기).
- **하이드레이션**: `use-tier-persist-hydrated` — 템플릿 로드 effect가 persist 복원 전에 도는 것 방지.
- **메모**: 구글 프로필 이미지 `lh3.googleusercontent.com` **429** 는 CDN 레이트리밋 가능성 — 코드 이슈 아님, 재시도·캐시·(장기) 아바타 자체 호스팅 검토.

---

## OAuth · 로그인 흐름 (현행)

1. `**/login`** → `{API}/oauth2/authorization/{provider}` (팝업 또는 동일 탭).
2. 성공 시 Refresh **HttpOnly** 쿠키, `**/auth/callback?exchange=…`** → `**POST /api/v1/auth/oauth-exchange**` 로 Access JSON.
3. `**apiFetch**`: `credentials: 'include'` · 401 시 `**/auth/refresh**` · 로그아웃 `**POST /auth/logout**`.

---

## 기획 요약 (MVP ~ 확장)

- **Auth (확정)**: **소셜 전용** — 자체 이메일 가입/로그인 없음. 보관본 MVP 표의 이메일 문구는 기획 정리 시 삭제·수정 대상.
- **로드맵**: P0 수치 정합 · P1 OG/워터마크 **완료** · P2 커뮤니티 · P3 게시판·스트리머 — 상세는 보관본 **기획·아키텍처** 절. **스트리머·월드컵**은 코어 이후 **최후순위**이며 순서는 **스트리머 → 월드컵**.

---

## Phase 체크리스트 (요약)

### Phase 1 — 뼈대

- 소셜 OAuth · GNB · `/templates`·`/tier` · 월드컵 UI 비노출
- 로그아웃 — Refresh 무효화·블랙리스트(2026-03-26)

### Phase 2 — 기획

- Tier Maker 화면·백엔드 스펙·R2 (구현 기준 확정)
- World Cup — **최후순위**(티어 코어 후; 스트리머보다 뒤)
- 스트리머 모드 범위 — **최후순위**(코어 기능 후; 월드컵보다 앞)
- **P2 커뮤니티·소셜** — 아래 「커뮤니티 확장 (P2 로드맵)」세부 기획(확정)

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

- 티어 템플릿·이미지·결과·프론트(R2)
- World Cup — **최후순위**(스트리머보다 뒤)
- 스트리머 모드 — **최후순위**(월드컵보다 앞)

### Phase 4 — Auth · 운영

- Kakao·Naver · 소셜 전용 정책 · Refresh/로그아웃 · Lightsail+GHA 배포 뼈대
- Vercel/env·도메인 점검 지속 (`DEPLOYMENT-CHECKLIST`)

### Phase 5 — Ops

- 백업·모니터링·스케일아웃 — MVP 이후
- **Docker 재시작 정책 최적화:** `docker-compose.yml`의 백엔드(`api`) 컨테이너 재시작 정책을 `restart: unless-stopped`로 설정하여 의도치 않은 OOM 종료 시에만 자동 복구되도록 구성.
- **장애 모니터링 및 알림 구축:** UptimeRobot 등을 활용해 외곽에서 API 헬스체크(`/actuator/health` 등)를 5분 주기로 찌르고, 서버가 뻗거나 응답이 없을 경우에만 **디스코드(Discord) 웹훅**으로 알림을 발송하도록 세팅 (정상 배포 시의 불필요한 알림 방지).

---

## 다음 작업 (우선순위 · 한눈에)

**P0 (수치·한도·경계만 따로 묶음)**  
- **완료** — (2026-03-29) 텍스트·JSONB·PATCH·`export-modal`·이미지 `accept`·Bean Validation·`GlobalExceptionHandler` 정합. (2026-03-30) **이미지 업로드 8MB 통일**(Nginx·Spring·Tomcat)·순차 단일 파일 POST 문서화·UI 안내·413 메시지.

**P0 다음 (코어 티어·제품)**  
1. ~~결과 **제목·설명** 수정~~ → **완료 (2026-03-28)** — `/tier/my`·`/tier/result/[id]`·`/tier/feed` + PATCH API. (**썸네일만** 별도 수정 UI는 미구현 시 선택 과제.)  
2. **템플릿 역할·용어 정리** — **(2026-03-30)** `PROGRESS.md` 「제품 용어」·DB **`template_status`** 반영·권한·삭제 템플릿 파생/결과 차단 점검 완료. **남음**: UI·문서 전반 라벨 통일, **비공개 템플릿** 등 공개 범위 제품 스펙 확정·구현(보관본 `progress/PROGRESS_20260327.md` 「다음 작업 예정」1번).  
3. ~~**이미지 인프라(서버·CDN) 1차**~~ — **완료 (2026-03-31)** — API 이미지 프록시 **장기 캐시 헤더** · Next **`remotePatterns`**(`img.pickty.app` 등) 유지 + **`minimumCacheTTL` 1년** · 배포 체크리스트 **CF R2/CDN 가이드** · **(2026-03-30)** CF 대시보드 Cache Rule + **`curl` MISS→HIT** 운영 검증(아래 「배포·운영」). **Soft Launch 이후 선택**: R2 객체 메타 캐시·**파생 해상도**(썸네일 전용)·CF Images — 당장 필수 아님(프론트 WebP + CDN·브라우저 캐시로 1차 충분).

**그다음**  
4. **P2 커뮤니티** — **(2026-03-30) 1차 완료** + **동일일** 목록·상세 **`myReaction`**·비회원 `localStorage`로 **반응 하이라이트 영속**. **남음**: 집계 티어·인기 결과 슬라이더·조회수(Valkey 배치) 등 「커뮤니티 확장」절 나머지.  
5. **배포·운영** 지속 점검(`DEPLOYMENT-CHECKLIST`) · **Phase 5 Ops**(헬스 알림·Docker 재시작 정책 등 — MVP 이후 병행 가능).

**최후순위 축 (순서 고정)**  
6. **스트리머 모드** + 위 「대규모 트래픽 방어」구현(Valkey 캐시·휘발성 쓰기·귀속 등).  
7. **Ideal Type 월드컵** — 스트리머보다 뒤, 티어 코어 거의 끝난 뒤 착수.

---

## 템플릿 유니버스 (가칭) — 파생된 템플릿들을 모아서 조회 — 장기 아이디어 메모 **(구현·일정 미정)**

- **의도**: 템플릿 ID 하나만 있고 최초 조상(시조)을 모를 때, **역추적으로 루트를 찾은 뒤** 그 루트에서 파생된 **전체 자손**을 한꺼번에 조회하는 기능. **당장 할지·언제 할지 미정** — 설계 대비용 기록만.
- **현재 DB 모델**: `tier_templates.parent_template_id` — 부모 1명만 가리키는 **인접 리스트**. 이 구조만으로도 PostgreSQL **`WITH RECURSIVE`** 로 **위(조상)·아래(자손)** 방향 조회가 **기술적으로 가능**(단일 부모 트리/숲 전제). **순환**이 생기면 재귀가 위험하므로 앱·DB 제약으로 방지할 것.
- **나중에 규모가 커지면 검토**: `parent_template_id` **인덱스**(자손 탐색용), **FK**·삭제 정책, Spring/JPA에서는 깊은 엔티티 그래프 대신 **네이티브 재귀 쿼리**·응답 크기 제한; 더 필요하면 **루트(또는 lineage) ID 비정규화**·closure 등 읽기 최적화.

---

## 배포 · 운영

- nginx 443 → API. `**~/Pickty/deploy/lightsail/application-secrets.yaml`** 필수.
- `img.pickty.app` **403** vs API **404** 진단은 보관본 R2 절 또는 `LOCAL-DEV.md`.
- **Cloudflare 캐시 점검(재현)** **(2026-03-30)**: PowerShell에서는 **`curl.exe`** 사용. `KEY` = `GET https://api.pickty.app/api/v1/templates?size=1` JSON의 `thumbnailUrl` 마지막 경로세그먼트(예: `….webp`).  
  `curl.exe -sI "https://api.pickty.app/api/v1/images/file/<KEY>"` 를 **연속 2회** — **`cache-control`** 에 `max-age=31536000`·`immutable` · **`cf-cache-status`** `MISS` → `HIT` 기대(`vary: Origin` 등은 응답에 따라 캐시 키 분리 가능).

---

## 마이그레이션·코드 맵


| 파일                                                                                     | 메모                                                         |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `docs/migrations/2026-03-30-reactions-member-ip-hash-hybrid.sql`                        | 회원 반응에도 `guest_ip_hash` 허용·`(target_type,target_id,guest_ip_hash)` 유니크는 **`user_id IS NULL`** 행만(NAT 충돌 방지) |
| `docs/migrations/2026-03-31-p2-community-unified.sql`                                   | P2 `reactions`·`comments`·역정규화 카운트·게스트 반응 부분 유니크 |
| `docs/migrations/2026-03-30-rename-status-columns.sql`                                  | `tier_templates.status`→`template_status` · `tier_results.status`→`result_status`(있을 때만) |
| `docs/migrations/2026-03-25-p1-tier-template-user.sql`                                 | P1 썸네일                                                     |
| `docs/migrations/2026-03-26-users-merged-into-user-id.sql`                             | 병합                                                         |
| `frontend/src/lib/pickty-upload-hint.ts`                                               | 이미지 업로드 UX 안내(브라우저 압축·다장 시 시간)                    |
| `frontend/src/lib/pickty-image-url.ts`                                                 | `resolvePicktyImageUrlForOpenGraph`, 표시용 URL               |
| `frontend/src/lib/tier-result-opengraph.ts`, `template-opengraph.ts`                   | OG fetch                                                   |
| `frontend/src/components/tier/tier-board.tsx`, `export-modal.tsx`                      | 타겟팅·캡처·비회원 자동 저장 CTA · 다운로드 시에만 워터마크                                    |
| `frontend/src/lib/tier-capture-png.ts`                                                 | 클론 캡처 · `includeWatermark` · 미리보기/썸네일은 워터마크 off              |
| `frontend/src/app/tier/tier-page-client.tsx`                                           | 템플릿 메타·공유·툴바 · intent 시 `getTemplate` 생략(덮어쓰기 방지)              |
| `frontend/src/lib/store/tier-store.ts`                                                 | Zustand + **sessionStorage persist**, `tierAutoSaveIntent`, `workspaceTemplate*` |
| `frontend/src/lib/post-oauth-tier-flow.ts`, `tier-autosave-thumbnail.ts`               | OAuth/온보딩 후 자동 저장·썸네일 스태시                                  |
| `frontend/src/lib/hooks/use-tier-persist-hydrated.ts`                                  | 티어 persist 하이드 대기                                          |
| `frontend/src/app/login/page.tsx`, `auth/callback/page.tsx`, `signup/profile/page.tsx` | `resolvePostOAuthTierFlow` 연동                              |
| `frontend/src/components/layout/gnb.tsx`                                               | 모바일/내 정보 + 타겟 시 1차 클릭 해제 · **템플릿** / **티어표** 내비 · 계정 메뉴 **내 템플릿**                                   |
| `frontend/src/app/templates/mine/page.tsx`, `frontend/src/components/template/template-card.tsx` | **내 템플릿** 목록·카드 공통 컴포넌트                                   |
| `frontend/src/app/tier/feed/page.tsx`                                                  | 글로벌 피드·무한 스크롤                                                |
| `frontend/src/components/tier/tier-result-card.tsx`                                    | 내 티어표·피드 공통 카드(수정/삭제/리믹스 권한)                                |
| `frontend/src/components/tier/tier-result-edit-meta-modal.tsx` 등                      | 결과 메타 PATCH 모달·삭제 확인                                           |
| `backend/.../domain/tier/TierResultController.kt` 등                                   | 결과 POST/GET/PATCH/DELETE·**GET 페이징 목록**·`SecurityUtils`·`SecurityConfig` |
| `backend/.../domain/tier/`, `upload/`                                                  | 템플릿·결과·R2·`ImageUploadController`                          |
| `backend/.../domain/community/`, `frontend/src/lib/api/community-api.ts`, `frontend/src/components/community/` | P2 반응·댓글 API·UI |
| `backend/.../community/CommunityMyReactionService.kt`, `frontend/src/lib/store/reaction-store.ts` | 로그인 **`myReaction`** bulk · 비회원 반응 **`localStorage`** |


**구현 세부**(DnD N차 등)는 `**progress/PROGRESS_20260327.md`** 참고.

---

## 알려진 이슈 · 메모

- `next-themes` + React 19 콘솔 경고 — 라이브러리 한계.
- 워크스페이스는 `**Pickty/` 루트**만 열 것.
- 스트리머 모드 **대규모 트래픽 방어** 요지는 **「전체 진행 상태」표 직후 절**에 정리됨(구현 전 기획 확정분). **구현 순서는 월드컵보다 앞·둘 다 최후순위** — 표와 「다음 작업」절 참고.

