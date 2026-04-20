# Pickty 진행 현황

> **역할**: 웹 AI(Gemini)·에이전트용 **진행 요약**. 예전 장문 원본은 `**progress/PROGRESS_20260327.md`** · `**progress/PROGRESS_20260329.md`** · `**progress/PROGRESS_20260330.md**` 등에 보관.  
> **에이전트**: 코드 작업 전 **이 파일(`PROGRESS.md`)을 먼저** 읽고, 세부·날짜별 맥락은 보관본 해당 절을 참고.  
> **보관·다이어트**: `progress/`로 옮기거나 정본을 요약본으로 **교체**하는 일은 **사용자가 명시적으로 지시한 경우에만** — 에이전트가 길이만 보고 임의로 나누지 않음(절차: `pickty-project-context.mdc` 「진행 현황 파일 관리」).

---

## 워크스페이스 · 문서 (고정)

- Cursor는 `**Pickty/` 레포 루트만** 연 것을 전제로 한다.
- 맥락 문서: `**.cursor/rules/pickty-project-context.mdc`**(전역) + `**.cursor/rules/pickty-workflow-terms.mdc**`(기록·커밋·배포 용어·커밋 한글) + `**PROGRESS.md**`(진행).
- 비공개 설정 형제 폴더 `**pickty-config**` — 복사 절차는 `pickty-project-context.mdc` Git 블록. 실값·비번은 gitignore 파일에만.


| 경로                                        | 용도                                                            |
| ----------------------------------------- | ------------------------------------------------------------- |
| `progress/PROGRESS_20260327.md`           | 2026-03-27 이전 **전량** 진행 로그·체크리스트 보관                           |
| `progress/PROGRESS_20260329.md`           | 2026-03-29 **검증 정합·템플릿 UGC(소프트삭제·PATCH 메타·파생)·목록 UI** 요약 보관   |
| `progress/PROGRESS_20260330.md`           | 2026-03-30 **법무 웹 노출·탈퇴 모달·약관 명칭(서비스 제공자)** 등 보관              |
| `progress/PROGRESS_20260331.md`           | 2026-03-31 `**/template/new` 도화지·미리보기** 상세 정리 보관 (표배경 UI는 04-01 이후 본문·정본 문서에 반영됨) |
| `docs/TEMPLATE_NEW_CANVAS_AND_PREVIEW.md` | 템플릿 만들기 **도화지·미리보기·board_config·레이어** 정본                      |
| `docs/LOCAL-DEV.md`                       | 로컬 실행(Windows, JDK 25, 프론트 **3002**, `dev`/`local` 프로필)       |
| `docs/DEPLOYMENT-CHECKLIST.md`            | **상단 표**: Vercel(프론트)·Actions(백엔드 path)·pickty-config(시크릿). OAuth·CORS·`npm run verify:deploy` |
| `deploy/lightsail/README.md`              | Lightsail·compose·시크릿 경로                                      |


**브랜치**: `dev` 평소 개발 · `main` 배포(직접 push 금지, `dev` PR 머지).

---

## 레포 · 스택 (요약)

- **레포**: [https://github.com/sleep5115/Pickty](https://github.com/sleep5115/Pickty) — `frontend/`(Next 16 App Router, React 19, Tailwind v4), `backend/`(Kotlin 2.2, Spring Boot 4, Java 25).
- **로컬 DB(선택)**: `docker-compose.yml` — 호스트 **5442·6380** → Postgres 17 / Valkey 9. 루트 `**.env**` 에 `POSTGRES_PASSWORD` 만(실값 비커밋).

---

## 제품 용어 **(2026-03-30)**

- **사용자에게 보이는 말**: **티어표**로 통일(메이커 `/tier`·저장본 `/tier/result/…`·피드·내 티어표 등). `/tier`와 `/tier/result`를 헷갈리면 **라우트·화면**으로 구분한다.
- **템플릿**: S/A/B에 올리기 **전** 아이템 집합(밀키트·원본 판). DB `**tier_templates**` · 소프트 삭제 `**template_status**` (`ACTIVE`  `DELETED`).
- `**tier_results**`: 메이커에서 배치·**저장**한 뒤의 DB 행(`template_id` 참조) · `**result_status**` · 삭제 시 `**is_public` false** · 피드·**내 티어표** 목록 API는 `**ACTIVE`만**. 마이그레이션: `**docs/migrations/2026-03-30-tier-results-result-status-soft-delete.sql**`.

**계정 상태**와 구분: 유저는 `**users.account_status**` (`AccountStatus`), 템플릿은 `**template_status**` (`TemplateStatus`).

- **배경 용어 (2026-04-01)** — 지금 도메인은 티어뿐이라 접두어 생략 가능. **라벨배경**: S/A/B **라벨 칸** 단색·이미지 등. **표배경**: 라벨열+아이템열이 있는 **표 본문** 뒤의 전체 배경(색·이미지). ⚙·행 순서 **핸들** 열은 UI 크롬이라 표배경·PNG·썸네일에 포함하지 않음.

---

## 진행 메모 **(2026-03-31)**

- `**/template/new` 도화지·미리보기(정본)**: `**docs/TEMPLATE_NEW_CANVAS_AND_PREVIEW.md**` — 캔버스 레이어(z-index)·`showLabelColor`/`paintLabelColorUnderImage`·톱니바퀴·`board_config` 저장·불러오기·회귀 체크 메모. ~~당시 적어 둔 표 전체 **배경색 UI** 과제~~ → **완료 (2026-04-01~02)** — 플로팅 도구·`workspaceBoardSurface.backgroundColor`/`backgroundUrl`·프리셋 팔레트 등은 아래 「진행 메모 (2026-04-01·04-02)」·정본 문서 참고.
- `**/template/new` 도화지(한 줄)**: 상단 `**TemplateBoardCanvasEditor**` — 표 배경 이미지·행 라벨(이미지 유무에 따라 `TierLabelCellView` 또는 동일 스타일 업로드 칸)·행 추가·**기본 세팅**. 하단 `**TierBoard variant="template-preview"**` + `**syncTemplatePreviewPoolFromForm**`.
- **좋아요 UI** (`**TemplateLikeButton**`): `**appearance="boxed"**` (`/tier` 헤더) — 연한 핑크 박스·선택 시 **테두리 글로우**(추천/비추천 `size="lg"`와 같은 패턴). `**plain**`(템플릿 목록 카드) — **글로우 없음**·항상 **핑크** 글자·테두리 없음(잠금 카드는 수치만).
- **용어·문서**: `PROGRESS.md`에서 **결과/결과표**라는 별도 사용자 용어 안내 삭제 — 화면·카피는 **티어표**, 기술 구분은 `**tier_results**`·라우트 등으로 기술. **법무** — `TERMS_OF_SERVICE_KO.md`·`PRIVACY_POLICY_KO.md`에서 **결과표**·**결과물** 제거·**티어표** 등으로 정리. **커서룰** — `pickty-project-context.mdc` UGC 예시 문장을 `**tier_results**` 기준으로 수정.
- **PROGRESS 동기화**: P2 표·「다음 작업」에 **인기 티어표 Top3** API·슬라이더 반영, 템플릿 **비공개** backlog를 **소프트 삭제·`mine` ACTIVE만** 등 실제 구현에 맞게 정리.

---

## 진행 메모 **(2026-04-01)**

- **라벨배경·표배경** 사용자·문서 용어: 위 「제품 용어」 절 — ⚙·행 순서 핸들 열은 UI 크롬(표배경·PNG·썸네일에 넣지 않음).
- **티어 결과 스냅샷** `workspaceBoardSurface` 선택 필드 — 저장·자동저장 시 포함, `**/tier/result**`·**리믹스**(`hydrateFromResultSnapshot`)에서 표배경 복원. **구 저장본**은 필드 없어 표배경 없을 수 있음.
- `**TierBoardReadonly**`: 읽기 전용 행에서 ⚙·핸들용 빈 열 제거, 표배경 `inset` 전체(콘텐츠 너비만 존재).
- `**/tier` `TierBoard**`: 표배경 레이어 `calc(100% - 4rem)` + `data-tier-board-surface` — 화면에서는 크롬 열에 표배경 미적용.
- `**tier-capture-png**`: 클론에서 `data-capture-ignore` 노드 제거 후 `[data-tier-board-surface]` 풀블리드 — 다운로드·저장 썸네일에서 크롬 열 제외·빈 띠 방지.
- `**TierRow**`: 템플릿 미리보기용 ⚙·핸들 placeholder에도 `data-capture-ignore`.
- **백엔드** `TierResult.kt` KDoc — `snapshotData`에 `workspaceBoardSurface` 선택 키 명시.
- `**/template/new` 도화지** **(2026-04-01)**: 표배경 점선 영역 — 빈 상태 시 중앙 힌트(이미지 업로드), 우측 상단 노션형 플로팅 도구(`배경색` / 적용 후 `배경 변경`·`배경색`·`지우기`). `workspaceBoardSurface.backgroundColor`·`backgroundUrl`과 연동. **(03-31 절에 남아 있던 ‘표 배경색 UI만 추가’ 과제는 본 구현으로 종료.)**

---

## 진행 메모 **(2026-04-02)**

- `**/template/new` 도화지**: `배경색` → 티어 설정과 동일 `**TIER_COLOR_PRESETS**` 팔레트 먼저, `**+**` 에서만 시스템 색 창(스포이드 등). 프리셋은 `**frontend/src/lib/tier-color-presets.ts**` 공유.
- **티어 설정 모달**: **누끼 뒤 매트** 체크박스·긴 설명 제거 — 라벨 이미지 있을 때 적용은 항상 `paintLabelColorUnderImage: true`로 단순화.
- **티어 설정 모달**: 라벨 배경 팔레트 맨 앞 **「없음」**(점선·`−`) — `showLabelColor: false`로 표배경만 비침.
- **티어 설정 모달**: 라벨 이미지 업로드 **압축·시간 안내** 문구(`PICKTY_IMAGE_UPLOAD_HINT`) 제거.
- **티어 설정 모달**: 라벨 미리보기(헤더·스와치·입력 옆)는 **실제 표배경 미사용** — 중립 회색(`MODAL_LABEL_PREVIEW_BG_CLASS`). 작은 박스에 보드 이미지 cover 시 본문·라벨 누끼가 겹쳐 보이던 문제 해소.
- `**/tier` 플레이 vs 템플릿 제작**: `TierSettingsModal`에 `**allowLabelImageUpload**` — 플레이 화면(`tier-page-client` → `TierBoard`)에서는 **false**로 라벨 칸 **이미지 업로드·제거 UI만 숨김**. 텍스트·프리셋 색·행 편집은 유지. `/template/new` 도화지·기본값은 제한 없음.

---

## 진행 메모 **(2026-04-03)**

- **티어 메이커 — 투명 블록(Spacer)**: `spacer-{uuid}` — DB 없이 Zustand·`snapshotData`에 포함. 미분류 헤더 **「투명 아이템 생성」**으로 풀 **맨 앞** 삽입. 편집: 점선만(`ItemCard`) · 읽기/PNG: `opacity-0`+레이아웃 유지 · `tier-capture-png` 클론에서 `data-tier-spacer` 시각 제거. **모바일**: `hidden sm:block`으로 스페이서 폭 미적용. `collectDistinctItems`·갤러리에서 `spacer-` 제외(템플릿 `items`·이미지 확대). `**/lib/tier-spacer-id.ts**` 분리로 `tier-snapshot`이 `tier-store`를 서버에서 끌지 않게 함(RSC `createContext` 오류 방지). `tier-store`는 `@dnd-kit/sortable` 대신 **로컬 `arrayMove`**.
- **티어 메이커 — DnD**: 미분류·티어 행 각각 `SortableContext`+`rectSortingStrategy`, 카드 `dragMode="sortable"`. `reorderPoolItems` / `reorderTierItems`·`moveItemsToPoolBefore` / `moveItemsToTierBefore`·같은 행 `reorderItemNextToRef`. **마지막 카드 뒤** 의도: 드래그 타일 **가로 중심**이 기준 카드 중심보다 오른쪽이면 `insertAfter`. `DndContext` **`closestCorners`**. (이전 「항상 기준 카드 앞만」삽입으로 맨 끝 드롭 시 마지막과만 바뀐 것처럼 보이던 문제 수정.)
- **조회수(1차)**: Valkey 배치 플러시·JDBC bulk·`tier_templates`/`tier_results` `view_count`(마이그레이션 `**docs/migrations/2026-04-03-add-view-count-columns.sql**`). API 응답·`tier-api` 타입·템플릿/티어표 카드 **`ViewCountInline`**·`/tier`·결과 단건 등 연동.

---

## 진행 메모 **(2026-04-04)**

- **티어 DnD — 미리보기=드롭**: `closestCorners`만으로는 Sortable이 **가로 중심 기준**과 다른 `over`를 잡아, 중심선 이전에도 **유령 슬롯**이 먼저 움직이던 현상. 대응: (1) 같은 미분류 풀·같은 티어 행·**단일 카드** 드래그 시 `onDragOver`에서 `reorderPoolItems`/`reorderTierItems`로 상태 동기화(기존). (2) **`tierItemCollisionDetection`** — `reorderItemNextToRef`로 **순서가 실제로 안 바뀌면** 충돌 결과를 **`over = active`**로 덮어 Sortable transform을 막음. `reorderItemNextToRef`는 DnD·충돌 공용으로 **`tier-store` export**.
- **티어 DnD — 빈 티어 줄 드롭**: `closestCorners`가 **드래그 카드 rect** 기준이라 커서는 아래 빈 행인데 `over`가 위쪽 S/A 아이템으로 잡히던 문제 — **`collisionsFromPointerInside`**: 포인터가 들어 있는 droppable만 모아 **면적 작은 순**(카드 우선)으로 정렬 후, 없으면 `closestCorners` 폴백.
- **조회수 이중 집계**: `GET /templates/{id}`·`GET /tiers/results/{id}`마다 Valkey `HINCRBY` 하는데, `/tier`는 **워크스페이스 로드**와 **토큰·반응 동기화** 두 effect가 각각 `getTemplate`을 호출해 **운영 +2·로컬(Strict) +4**처럼 보일 수 있음(템플릿 목록 개수와 무관). 대응: 쿼리 **`countView=false`**(집계 생략·미반영 delta만 HMGET) + 프론트는 동기화용 호출에만 적용, OG `fetch`도 `countView=false`. intent로 워크스페이스가 GET을 생략할 때만 동기화 effect에서 **1회** 집계. `/tier/result/…`는 같은 id로 토큰만 바뀔 때 `countView=false`.
- **저장|다운로드 모달 — autofill**: `globals.css`의 `-webkit-autofill`이 다크 색을 **전역** 적용해, 라이트 모드에서 Chrome 자동완성(「지난 완성 기록」 등) 선택 시 **제목 input만** 어둡게 보이던 현상 — `html:not(.dark)` / `html.dark`로 분리. `export-modal` 제목·설명에 `autoComplete="off"`·구분용 `name`.
- **`/login`**: 소셜 버튼 아래 **이용약관·개인정보처리방침 동의 문구** 제거 — 전역 **`SiteFooter`**에 동일 링크가 있어 중복 노출 방지.
- **업로드 압축 — Web Worker 폴백**: 번들 환경에서 `browser-image-compression` **Web Worker** 스크립트 로드가 실패하면 `ProgressEvent`만 reject 되어 **`/template/new`** 등에서 **첫 이미지부터 압축 실패**할 수 있음. `**frontend/src/lib/image-upload-api.ts**`: worker 실패 시 **`useWebWorker: false`**로 한 번 더 압축 재시도.
- **표배경 이미지 UX·알려진 한계**: `**/template/new`** 도화지 팁에 추천 **1008×480px**(티어 라벨 6칸 기준) 안내. **`/tier`** 에서는 아이템이 많아 행 높이가 커지면 **`background-size: cover`** 때문에 배경이 **확대·재크롭되는 느낌**이 날 수 있음 — 당장 동작 변경 없이 기록만.
- **티어·템플릿 이미지 잘림 완화**: 공용 `**frontend/src/components/tier/tier-item-tile-images.tsx**` — 정사각 타일 안 **`object-contain`** (초기 블러 배경 레이어는 제거). `**ItemCard**`·`**StaticItemCard**`·`**/template/new`** 아이템 그리드에 적용.
- **썸네일도 전신 보이기**: `**/template/new`** 직접·포크 썸네일 미리보기, `**template-card**` 목록, `**tier-result-card**` 미리보기 `contain` 정책 통일. 자동 2×2 합성 `**template-thumbnail-composite.ts**` 는 캔버스에 **`drawImageContain`**.
- **템플릿 카드 썸네일 비율**: 목록 카드 상단 영역 **`aspect-square`(1∶1)** — 자동 정사각 2×2 썸네일이 `contain` 일 때 좌우 여백 없이 맞음. 티어표 결과 카드는 **16∶10** 유지.

---

## 진행 메모 **(2026-04-05)**

- **`PROGRESS.md` 완료/잔여 표기**: 한 파일 안에서도 문단별로 시점이 달라 **완료 vs 미완료**가 엇갈릴 수 있음 — **정본**은 「전체 진행 상태」표 + 「다음 작업」; 갱신 시 로드맵 절·날짜 메모 **짝으로 함께** 맞출 것(에이전트 규칙: `pickty-project-context.mdc` 「진행 현황」).
- **집계 티어표 vs 조회수**: **무관**. 집계 티어표는 **여러 사람의 배치(스냅샷)를 템플릿 단위로 취합**해 보여주는 기능(미구현). 조회수는 **열기(조회) 횟수**만 세는 지표. 로드맵에서 나란히 나온 것은 **P2 확장 후보 목록**일 뿐, 데이터 파이프라인이 엮이지는 않음.
- **조회수(1차) 동작 요약**: 집계 시 Valkey 해시에 `HINCRBY` → API 응답은 **DB `view_count` 저장분 + Valkey 미반영 누적(pending)** 을 합산해 내려줌 → 화면 숫자는 **localStorage가 아니라** 서버 응답·React state. DB 영구 반영은 스케줄 **`ViewCountBatchScheduler` cron `0 0/5 * * * *`**(약 **5분**마다 drain + JDBC bulk).
- **조회수 정책(제품 확정)**: **동일인이 여러 번 조회해도 매번 +1** 유지. 고유 방문자 1회 등으로 줄이는 **정교화 백로그 없음**.
- **조회수 활용**: **당장** 템플릿/티어표 **인기 순위·큐레이션 등에 조회수를 쓸 계획 없음** — **표시용**이 목적. 나중에 “인기 콘텐츠를 무엇으로 정의할지(조회·추천·좋아요 등)”는 **그때 별도 기획**; 그때가 **운영·분석** 논의에 해당.
- **트래픽·퍼널 분석**: 페이지 유입·행동 통계는 **GA4** 등 외부 분석 도구가 적합 — **자체 통계 화면을 두는 것**과는 구분.
- **로드맵 단순화 (제품)**: 게시판(P3)만 **당면**; 집계 티어표·스트리머·멘션 등은 **「장기 아이디어」**. **이상형 월드컵**은 **게시판 마무리 후** 착수로 표·「다음 작업」에 명시.

---

## 진행 메모 **(2026-04-06)**

- **GA4 (프론트)**: `**frontend/src/app/layout.tsx**` — `@next/third-parties/google` 의 `**GoogleAnalytics**`, 환경 변수 `**NEXT_PUBLIC_GA_ID**`(Vercel·로컬 `**frontend/.env.local**` 등, **gitignore**). **스크립트는 `NODE_ENV === 'production'` 이고 ID가 비어 있지 않을 때만** 로드 — `**next dev**`(localhost:3002)에서는 **g/collect 요청이 안 보이는 것이 정상**. 로컬에서 수집 확인은 **`npm run build` + `npm run start`**(프로덕션 모드) 또는 배포 후 운영 도메인에서 DevTools Network 로 확인.
- **P3 게시판 프론트 1차 (작성·목록·라우팅)**: `**/community**`·`**/community/write**`·`**/community/[id]`(stub) 추가, GNB **커뮤니티** 탭(PC/모바일) 연결. 목록은 **컴팩트 행형 UI** + 제목 옆 이미지 아이콘 hover 시 **썸네일 미리보기**로 변경.
- **Tiptap 에디터 1차 완성**: 기본 서식 + 유튜브/트위터 임베드 + 픽티 링크 카드(React NodeView) + 접은 글(Details/Summary) + 이미지 리사이즈. `uploadPicktyImages` 연동, 글자수(10,000)·이미지(50) 제한, `handlePaste`/`handleDrop` 이미지 업로드 가로채기, 붙여넣기 HTML에서 `**<a><img/></a>**` 래퍼 해제, 상태바(글자수·이미지수) 추가.
- **이미지 표시 안전 경로 통일**: 에디터에 삽입되는 이미지 URL을 `**picktyImageDisplaySrc**`로 변환해 `img.pickty.app` 직링크 403/ORB를 우회 (`/api/pickty-image?key=...` 경유).
- **게시판 임시저장 UX 개편**: 자동저장/자동 confirm 폐기, **수동 임시저장** + `**불러오기(n)**` 모달(다중 draft 목록, 선택 복원·개별 삭제). 레거시 `pickty-board-draft`는 `pickty-board-drafts`로 1회 마이그레이션 후 제거.
- **레이아웃 폭 규칙 정리(헤더/본문 분리)**: `/tier/feed`·`/tier/my`·`/account`는 **헤더는 GNB 폭 유지**, 본문 카드/폼은 기존 좁은 `max-w-*`를 유지하도록 구조 분리.
- **R2 고아 이미지 정리 배치(백엔드)**: `ImageCleanupService` + `ImageCleanupController`(`POST /api/v1/admin/image-cleanup/run`) 추가. R2(S3Client) 전체 키와 DB 참조 키(`users.display_avatar_url`, `tier_templates`/`tier_results` 썸네일, JSONB `items`/`board_config`/`snapshot_data`)를 비교해 orphan 후보를 산출하고, 기본 **드라이 런**(삭제 없음)으로 키 샘플·총 용량 로그를 출력. `extensions=png,webp` 같은 확장자 필터 지원, 실제 삭제는 `dryRun=false & executeDelete=true & pickty.image-cleanup.allow-execute-delete=true` 3중 게이트로 제한.
- **P3 게시판(백엔드 API+DB·프론트 연동) 완료 및 배포 반영**: `community_posts` 마이그레이션·엔티티·리포지토리·서비스·컨트롤러(작성/목록/상세) 추가, 비회원 정책(닉네임/비번·IP 해시) 및 HTML sanitize 적용. 프론트는 `/community` 목록·`/community/write` 작성·`/community/[id]` 상세를 실 API와 연결하고, 작성 완료 후 토스트 + 목록 복귀 UX로 정리. 에디터는 최종적으로 **이미지 업로드·유튜브 링크·일반 링크** 3기능 중심으로 정리. 반영 커밋(`dev`): `0d58390`, 운영 반영용 `main` 머지 커밋: `8205a36`.

---

## 진행 메모 **(2026-04-07)**

- **게시판 댓글 연동 (community_post) 1차 완료**: `comments.target_type`은 기존부터 `varchar(32)`로 `community_post` 문자열 저장은 가능했으나, 서비스에서 `NOT_IMPLEMENTED`로 막고 있었다. `CommunityCommentService`에 `community_post` 허용·대상 검증(`community_posts` ACTIVE)·댓글 수 증감 로직을 추가하고, `community_posts.comment_count` 역정규화 컬럼 마이그레이션(`docs/migrations/2026-04-07-board-post-comment-count.sql`)을 반영.
- **게시글 상세 응답에 댓글 포함**: `GET /api/v1/community/posts/{id}`에서 `CommunityCommentService`를 호출해 댓글 첫 페이지(기본 30개)를 `comments`로 함께 반환하도록 DTO·서비스를 확장.
- **프론트 상세 하단 댓글 UI 연결**: `/community/[id]` 하단에 `CommentSection`을 `targetType="community_post"`·`targetId={post.id}`로 연결. 상세 API의 `comments`를 초기값으로 주입해 첫 렌더에서 불필요한 추가 목록 호출을 피함.

---

## 진행 메모 **(2026-04-09)**

- **AI 자동 템플릿 생성(AI 딸깍) 파이프라인 1차 완료**: 
  - **백엔드**: Gemini 2.5 Flash 모델 기반 아이템 리스트 생성(Phase 1) + Google Custom Search API 연동(Phase 2, Bing에서 롤백). Kotlin Coroutines(`async`/`awaitAll`)를 활용해 각 아이템별로 이미지 10개씩 병렬 검색하여 응답. 관리자 전용 엔드포인트 `POST /api/v1/admin/templates/auto-generate` 및 `@PreAuthorize` 보안 적용.
  - **프론트엔드**: `**/template/new` 도화지 상단에 AI 생성 UI 추가. 사용자가 입력한 주제로 아이템을 자동 생성하여 폼(`react-hook-form`)에 즉시 추가하는 기능 연동. 생성 중 로딩 상태(스피너) 및 에러 핸들링 UI 적용.
  - **인프라**: `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX`, `GEMINI_API_KEY` 환경 변수 구성.

---

## 진행 메모 **(2026-04-13)**

- **백엔드 도메인 리네이밍 + DB 마이그레이션 완료**: 패키지/폴더 매핑을 `community -> interaction`, `board -> community`로 재배치하고, 이에 맞춰 DB 스키마/마이그레이션도 함께 정리 완료. 기존 커뮤니티 반응·댓글 계층은 `interaction`으로, 게시판 계층은 `community` 네이밍으로 일관화.
- **도메인 분리/호적 정리 완료 상태 확정**: 백엔드 `Community / Interaction` 도메인 분리가 완료되었고, API 경로·타입·타깃 타입 명세를 포함한 호적 정리도 완료. 폴더 계층(`controller`/`service`/`repository`/`entity`/`dto`/`enums`/`support`)까지 정리 완료된 상태로 운영.

---

## 진행 메모 **(2026-04-20)**

- **GNB**: 티어 만들기·티어 피드·커뮤니티·월드컵을 **단일 pill**로 묶어 예전 패턴으로 복구(세 그룹 pill 분리 해제).
- **월드컵 플레이 결과·통계**: 마이그레이션 `**docs/migrations/2026-04-20-worldcup-play-results.sql**` (`worldcup_play_results`) · 엔티티·리포지토리 · `WorldCupPlayResultService`에서 한 판 종료 시 **이력 저장 + `WorldCupStatService` 통계 누적**을 동일 트랜잭션 처리 · `POST` 바디에 **`itemStats`** 포함. 프론트는 목업 제거 후 **`GET /api/v1/worldcup/templates/{id}`** 로 템플릿 로드·랭킹 **`GET .../ranking`** 연동·로딩 UI.
- **월드컵 템플릿 CRUD (티어 컨벤션 정렬)**: `POST/PATCH/DELETE /api/v1/worldcup/templates` · 목록·단건은 **`ACTIVE`만** · PATCH는 **작성자만**(메타: 제목·설명) · DELETE는 **작성자 또는 ADMIN** 소프트 삭제 · `SecurityConfig`에서 변이 API 인증. 허브 **`/worldcup`** 목록·카드·**`/worldcup/new`** 수동 생성 폼(`react-hook-form`) · 본인 카드 **케밥**(수정 모달·삭제 확인).
- **허브·진입 UX**: **`/worldcup`** 에서 API 목록·플레이 링크 · 만들기는 **`/worldcup/new`**(비로그인 시 로그인 `returnTo`).
- **`/worldcup/new` 에디터 고도화 (피쿠형)**: **상단** 기본 정보(제목·설명·레이아웃·목록 공개 안내 체크) / **하단** 후보 관리 · **일괄 추가** 모달(줄바꿈 구분 URL 일괄 등록·이름 자동 제안) · **테이블 뷰**(순번·썸네일 미리보기·이름·미디어 URL·삭제) · 유틸 **`frontend/src/lib/worldcup/worldcup-media-url.ts`** (유튜브 ID·썸네일·embed URL·미디어 분류) — 플레이 쪽 iframe 대비.

---

## 인프라 방향 · 스냅샷


| 구분        | 내용                                                                                                                                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API·DB·캐시 | **AWS Lightsail** 서울 — Docker로 PostgreSQL 17 + Valkey 9                                                                                                                                                                                                                                                 |
| 이미지       | **Cloudflare R2** (S3 API), 버킷 `**pickty-images**`, 공개 `**img.pickty.app**` · **(2026-03-31)** API `GET .../images/file`·Next `minimumCacheTTL`·배포 문서 **3.5** · **(2026-03-30)** 대시보드 Cache Rule(Edge/Browser TTL 1년) 후 `**curl` 검증**: `cf-cache-status` **MISS→HIT**, `Cache-Control` **immutable** 유지 |
| 프론트       | **Vercel** 등(도메인 `**pickty.app**`, API `**api.pickty.app**`)                                                                                                                                                                                                                                            |


**DB 이름**: 클러스터 안 형제 DB — `**pickty_dev**`(개발) · `**pickty_prod**`(운영) · `**pickty**`(로컬/DBeaver 앵커 등) · 시스템 `**postgres**`. 한 연결의 초기 Database는 하나만; **Show all databases**로 트리에서 형제 확인. `*postgres`·template DROP 금지.**

**DBeaver**: Host/Port/User/Password는 `**application-secrets.yaml`** / pickty-config. 단계별 스크린 설명은 `**progress/PROGRESS_20260327.md**` 또는 `LOCAL-DEV.md`.

---

## 전체 진행 상태 (동기화됨)

**잔여·완료 표기**: 기능 단위 **완료/미완료**는 아래 표와 **「다음 작업」**을 맞출 것. 날짜 메모(위 「진행 메모」)는 **사실 기록**, 로드맵 절(「커뮤니티 확장」 등)은 **기획·역사** — 서로 다르면 **표 + 다음 작업**을 기준으로 로드맵 문장을 고친다. 에이전트·기록 시 동일 기능을 한 곳만 갱신하지 말고 **짝이 되는 문단을 함께** 수정한다.


| 영역                                        | 상태    | 비고                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 개발 환경·모노레포·pickty-config                  | ✅     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **GA4 (웹 분석)** **(2026-04-06)**              | ✅(1차) | `**@next/third-parties**` `GoogleAnalytics` · `**NEXT_PUBLIC_GA_ID**` — **프로덕션 빌드에서만** 로드(위 「2026-04-06」). Vercel 프로젝트 환경 변수 수동 등록.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| GNB·테마·기본 라우팅                             | ✅     | 티어 허브 `**/templates**`, `**/tier/feed**`, **`/community`**, **`/worldcup`** — 단일 pill 네비 · **(2026-03-28)** 명칭 정리 · **(2026-03-30)** 전역 `**SiteFooter**` — 이용약관(`**/terms`**), 개인정보처리방침(`**/privacy**`), 문의 메일 · **(2026-03-30)** 계정 드롭다운 **내 템플릿** `**/templates/mine`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Auth — 소셜·온보딩·계정·병합·탈퇴                    | ✅     | Google·Kakao·Naver, `/signup/profile`, Merge·`MERGED`, `DELETE /me` · **(2026-03-30)** 탈퇴 확인 모달: 개인정보 즉시 파기·**서비스에 게시·작성한 모든 콘텐츠**는 탈퇴 후 수정·삭제 불가(월드컵·게시판 등 확장 대비 포괄 문구) · **이용약관·개인정보처리방침** 링크는 **`SiteFooter`**(전역) — **(2026-04-04)** `/login` 카드 내 중복 동의 문구 제거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Auth — 세션 하드닝 **(2026-03-26)**            | ✅     | Refresh **HttpOnly** 쿠키, OAuth 후 `**?exchange` → `POST /api/v1/auth/oauth-exchange`**, `**/auth/refresh`·`/auth/logout**`, Access **블랙리스트**, `credentials: 'include'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Tier Maker — 보드 UX                        | ✅     | DnD·행 정렬·설정 모달·멀티 선택·캡처·라이트/다크·모바일 · **(2026-04-03)** 투명 스페이서(`spacer-`)·풀/행 **Sortable**·카드 가로중심 기준 앞/뒤 삽입·`tier-spacer-id`/로컬 `arrayMove`로 RSC 안전 · **(2026-04-04)** `onDragOver`+커스텀 collision으로 가로중심·Sortable 유령 슬롯 정합                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tier — 템플릿·이미지·`tiers/results` API + R2   | ✅     | `POST/GET templates`, `**GET /templates/mine**`(인증·본인 `creator_id`·`ACTIVE`만) `**/templates/mine**` 페이지 · `**PATCH/DELETE /templates/{id}**` **(2026-03-29)** — 메타만 PATCH·**소프트 삭제**(`template_status`/`@ColumnDefault('ACTIVE')`)·목록은 ACTIVE만·단건 GET은 삭제 포함 · `**forkTemplateId**` 파생 · `POST /images`→R2 등 나머지 동일 · **(2026-03-28)** `tier_results` `PATCH`/`DELETE`·피드·리믹스·`**/tier/feed**` · **(2026-03-30)** DB `status`→`template_status`, 파생·**새 티어표 저장** 시 삭제된 템플릿 차단 · `**tier_results` `DELETE`**는 **소프트**(`result_status`·비공개)·**피드·내 티어표 목록** 모두 `ACTIVE`만                                                                                                                                                                                                                                                                                                                                                                                         |
| Tier — 비회원 → 로그인/가입 **자동 저장**             | ✅(1차) | `tier-store` **sessionStorage persist** + `tierAutoSaveIntent` · `post-oauth-tier-flow` · 로그인/`auth/callback`/온보딩 후 `**POST /api/v1/tiers/results`** · 미리보기 PNG `**tier-autosave-thumbnail`** 스태시→인증 후 R2 업로드(수동 저장과 동일 보드 썸네일) · `/tier` 템플릿 진입 시 intent+`templateId` 일치하면 **서버 덮어쓰기 생략**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 프론트 업로드 압축·한도 동기화                         | ✅     | `uploadPicktyImages` **파일당 순차 POST**(벌크 아님) · `browser-image-compression` WebP·장변 1024·목표 **~0.5MB** — **Nginx·Spring multipart·Tomcat 요청당 8MB** 통일 **(2026-03-30)** · `pickty-upload-hint.ts` UI 안내                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **P2 커뮤니티 — 반응·댓글 (1차)** **(2026-03-30)** | ✅(1차) | 다형성 `reactions`·`comments` + `tier_templates`/`tier_results` 역정규화 카운트. API: `POST /api/v1/interaction/reactions/toggle`(회원·비회원 IP 해시), 댓글 CRUD·페이지 `GET`·`DELETE`(비회원 비번). 프론트: `community-api`·`TemplateLikeButton`·`ResultVoteButtons`(낙관적 UI)·`CommentSection` — `/templates`·`/tier`·`/tier/feed`·`/tier/result/[id]` 연동. 마이그레이션 `**docs/migrations/2026-03-31-p2-community-unified.sql**` · **(2026-03-30) 새로고침 후 하이라이트 유지**: 로그인 시 템플릿·`tier_results` 단건/목록 GET 응답 `**myReaction**` + `ReactionRepository` **IN** bulk(`CommunityMyReactionService`) · 비회원은 `**reaction-store**`(`localStorage`) · **선택 상태 색**: 좋아요 **핑크**·추천 **빨강**·비추천 **파랑** · **회원+IP 하이브리드**: `guest_ip_hash`·부분 유니크(`user_id IS NULL`만) — `**docs/migrations/2026-03-30-reactions-member-ip-hash-hybrid.sql**`. · **(2026-03-31) 인기 티어표 Top3**: `GET .../tiers/results/popular` + `**popular-tier-results.tsx**`(`/tier` 보드 아래·댓글 위 가로 슬라이더). · **(2026-04-03) 조회수 1차**: Valkey·`view_count`·UI — **표시용**·**당장 랭킹 등 다른 용도 계획 없음**(「2026-04-05」). · **추가 커뮤니티 확장**(집계 티어표 등)은 **「장기 아이디어」**. |
| Tier — 장기 과제 (일반)                         | ✅(1차) | **이미 함**: 업로드 전 브라우저 압축. **(2026-03-31 1차 완료)**: `GET .../images/file/`** `**Cache-Control: public, max-age=31536000, immutable**` · `**next.config.ts**` `images.minimumCacheTTL` **31536000** · `**docs/DEPLOYMENT-CHECKLIST.md**` 「3.5 Cloudflare R2 및 CDN 캐시」. **(2026-03-30) 운영 검증**: `api.pickty.app` 프록시 경로에 대해 `**curl.exe -sI**` 2연속 → `**cf-cache-status` MISS then HIT**. **추후(선택)**: R2 `PutObject` **Cache-Control** 메타·**파생 해상도**·Cloudflare Images 등(트래픽·비용 보고 후) — 필요 시 「장기 아이디어」절.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **P3 커뮤니티 게시판** (TipTap·리치 에디터)           | 🟨(진행중) | 1차 기반(DB·작성/목록/상세 API·프론트 연동) + **게시판 댓글(`community_post`) 연동** 완료(2026-04-07). **잔여**: 게시글 **수정**, **삭제(소프트 삭제)**, 게시글 **추천/비추천**, 작성/상세 UX·권한/예외 처리 등 **디테일 보완**. 에디터 기능 범위는 **이미지 업로드·유튜브 링크·일반 링크** 3축 유지. |
| **AI 자동 템플릿 생성 (AI 딸깍)**             | 🟨(진행중) | **Phase 1(텍스트) & Phase 2(이미지 검색) 완료(2026-04-09)**. Gemini 1.5 Flash + Google Custom Search API 연동. Kotlin Coroutines 기반 병렬 호출 처리 완료. Phase 3(Vision)는 Stub 처리됨. |
| **Ideal Type 이상형 월드컵**                      | 🟨(진행중) | **(2026-04-20)** 플레이·결과 제출·통계·랭킹·템플릿 **CRUD**·허브·`/worldcup/new` 에디터(일괄 추가·테이블)까지 1차 연동. **잔여**: 플레이 화면 **유튜브 iframe** 등 미디어 타입별 렌더, AI 자동 생성(딸깍) 월드컵 경로, **목록 공개 정책 DB 반영**(현재 UI는 안내 수준) 등. 스트리머·집계 확장은 「장기 아이디어」.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |


---

## 현재 제품 동작 (2026-03 후반 기준)

- **라우팅**: 랜딩 → `**/templates`** → 카드 `**/tier?templateId=**` · 새 밀키트 `**/template/new**` · 템플릿 **제목/설명 수정**은 **모달**(목록·`/tier` 헤더 케밥) + `**PATCH /templates/{id}**` · **파생** `**/template/new?forkTemplateId=`**(`parentTemplateId` 기록) · **(2026-03-30)** 정적 `**/terms**` · `**/privacy**`(마크다운 렌더), **`SiteFooter`** 약관·방침 링크 **(2026-04-04)** `/login` 카드 중복 문구 제거.
- **업로드·저장**: `**POST /api/v1/images`** → R2 `PutObject` · DB/JSON 메타는 `https://img.pickty.app/{uuid}.ext` 형(설정 `public-url`). 표시는 `**picktyImageDisplaySrc**` / `**GET /api/v1/images/file/{key}**`(CORS `*`) — **(2026-03-31)** 해당 GET 응답 `**Cache-Control: public, max-age=31536000, immutable**` · Next `**next/image**` 원격 최소 캐시 `**minimumCacheTTL: 31536000**` (`next.config.ts`). **(2026-03-30)** Cloudflare Cache Rule 적용 후 동 경로에 `**curl -sI**` 2회 시 `**Server: cloudflare**`, `**cf-cache-status**`: 첫 `**MISS**`·둘째 `**HIT**` (엣지 캐시 동작 확인). 키 샘플은 공개 `**GET /api/v1/templates**` 의 `**thumbnailUrl**` 파일명 부분 사용 가능.
- **템플릿 썸네일**: DB `**tier_templates.thumbnail_url`** 단일. 2×2 `**template-thumbnail-composite.ts**`(Canvas). 마이그레이션: `docs/migrations/2026-03-25-p1-tier-template-user.sql`.
- **저장 티어표** (`tier_results`): 저장 시 PNG·`**tier_results.thumbnail_url`** · 동적 OG `**/tier/result/[id]**` · `**pickty.app**` 워터마크는 **PNG 다운로드 시에만**(`tier-capture-png` `includeWatermark`) — 편집 화면·보내기 모달 **미리보기**·서버 썸네일에는 비포함 **(2026-03-28)**.
- **내 티어표**: GNB **내 정보** → `**/tier/my`** · `GET .../tiers/results/mine` **ACTIVE만**(삭제한 건 목록에서 제외, 직접 URL·OG는 유지) · 카드 **수정/삭제/리믹스**.
- **내 템플릿**: GNB **내 정보** → `**/templates/mine`**(로그인) · `GET /api/v1/templates/mine` — 본인이 만든 **ACTIVE** 템플릿만 · 카드는 전체 목록과 동일(티어 만들기·좋아요·수정/삭제). `**frontend/src/components/template/template-card.tsx**` 공통.
- **글로벌 피드**: `**/tier/feed`** — `GET /api/v1/tiers/results` **ACTIVE만** **무한 스크롤** · 카드 권한: **수정=본인만**, **삭제=본인 또는 ADMIN**, **리믹스=항상** · **(2026-03-30)** 카드에 **추천/비추천**(낙관적 UI).
- **인기 티어표(템플릿별 Top3)** **(2026-03-31)**: `**/tier?templateId=**` — **보드 아래·템플릿 댓글(`CommentSection`) 위** · `GET .../tiers/results/popular` · `**PopularTierResults**` 가로 스크롤(모바일)·그리드(넓은 화면); 추천 수 상위 최대 3건, 없으면 섹션 미표시.
- **P2 커뮤니티 (1차)**: 템플릿 **좋아요**(`/templates` 카드·`/tier`는 `**tier-board**` 저장다운로드 줄 **왼쪽** **(2026-03-30)**), **추천/비추천**(피드 카드·`/tier/result/[id]` 상세), **통합 댓글**(`/tier`·`/tier/result/[id]`·`/community/[id]` 하단, 2026-04-07). 비회원 댓글은 닉네임(선택)·비번(필수)·표시 `익명 (IP 앞 두 마디)`; API는 `**/api/v1/interaction/**`**. 반응 UI는 **새로고침 후에도 유지** — 회원: 목록·상세 GET의 `**myReaction**`(JWT 시 bulk 조회); 비회원: `**pickty.community.reactions.v1**` `localStorage` · 버튼 **선택 색**: 좋아요 **핑크**·추천 **빨강**·비추천 **파랑** · **(2026-03-30)** 카드 추천/비추천 **상시 빨강·파랑**, 상세는 **글로우로 내 선택** — 위 **「추천/비추천·템플릿 좋아요 UI」** 절.
- **비회원 저장→소셜**: export 모달 **「로그인하고 서버에 저장」** → 보드·intent **sessionStorage** · **ACTIVE** 즉시 티어표 저장 후 `**/tier/result/[id]`** · **PENDING** 은 온보딩 후 저장·이동 · 비회원 시 **제목·설명 입력 없음**(기본 제목 등) — **메타 수정**은 `/tier/my`·`/tier/result/[id]`·피드 카드에서 가능.
- **공유·OG**: `generateMetadata` + `fetchTierResultForOpenGraph` / `fetchTemplateForOpenGraph`. **카톡 등 크롤러용 `og:image**` 는 R2 직링크 대신 `**resolvePicktyImageUrlForOpenGraph**` 로 `**https://api.pickty.app/api/v1/images/file/{key}**` 절대 URL 사용(`pickty-image-url.ts`). UI: `**sonner**` 토스트(클립보드) — `tier-page-client`(템플릿 링크), `tier-result-client-page`, `export-modal` 저장 완료 화면.
- **이미지 업로드 한도**: `**uploadPicktyImages**` — 압축 후 **파일마다 별도 `POST /api/v1/images**`(순차, 단일 `files` 파트). **8MB** — `**deploy/lightsail/nginx.conf`** `client_max_body_size` · `**application.yaml`** `spring.servlet.multipart` + `server.tomcat` · `**TomcatMaxPostSizeCustomizer**` 동일. 브라우저 쪽 목표는 **~0.5MB/장**(장변 1024 WebP).
- **Next 16**: 로컬 API URL `next/image` 시 `**dangerouslyAllowLocalIP: true`**.

---

## 티어 메이커 · GNB · 캡처 **(2026-03-28)**

- **GNB**: 첫 탭 **「템플릿」**(`/templates`), 둘째 **「티어표」**(`/tier/feed`). **내 정보** 드롭다운: **내 계정**·**내 티어표**·**내 템플릿** (`/templates/mine`)·로그아웃 — **(2026-03-30)** 예전 드롭다운의 공개 피드 단축 링크는 **내 템플릿**으로 대체(피드는 상단 **티어표** 탭). 피드·내 티어표 페이지 제목/링크에서 「최신 피드」→「티어표」.
- **피드·내 티어표 카드**(`tier-result-card`): 수정·삭제를 **세로 점 3개(⋮, `MoreVertical`)** 드롭다운으로 통일(`/tier/result/[id]` 상세와 동일 패턴). **(2026-03-29)** 카드 `overflow-hidden` 제거·메뉴 `z-[100]` 로 클립 방지.
- `**/tier` 상단**: 스토어 `workspaceTemplateTitle` / `workspaceTemplateDescription` — **템플릿 제목·설명**·(권한 시) **케밥**·**🔗 템플릿 공유**·PC/터치·초기화. **파생(새 템플릿 만들기)** 링크는 `**tier-board`**의 **저장다운로드** 줄 **왼쪽** **(2026-03-29)**. **템플릿 좋아요**는 제목 옆이 아니라 같은 줄에서 **저장다운로드 버튼 왼쪽**(`templateLikeSlot`) **(2026-03-30)**. **타겟팅·단축키·일괄 이동** 안내 문구는 **티어 행(`captureRef`) 바로 아래** — PNG·저장용 캡처에는 **미포함**; 페이지 하단 전용 푸터는 제거 **(2026-03-30)**. 크롬 줄(`zinc-950`)과 한 덩어리로 표 판(`zinc-900`)과 시각 분리.
- **워터마크**: 라이브 보드·export 미리보기 **비표시**; **이미지 다운로드**(export 모달·`/tier/result` PNG)에만 삽입. 글자 크기 티어 라벨 `**text-2xl` 급**.
- **에이전트 규칙**: `**.cursor/rules/pickty-workflow-terms.mdc`** — **기록**=`PROGRESS.md` 갱신, **커밋**=Pickty `dev` + pickty-config `main`, **배포**=Pickty `dev` push·`main` 머지 + pickty-config `main` push; **커밋 로그 본문 한글**.

---

## 템플릿 UGC·검증·목록 UI **(2026-03-29)**

- **백엔드**: 템플릿 `**TemplateStatus`** 컬럼명 `**template_status**`, 목록 `**ACTIVE`만**, `**DELETE` 소프트**(409·하드 삭제 폐기), `**PATCH .../templates/{id}`** — `UpdateTemplateMetaRequest`(제목·설명만, 아이템 불변). `**GET /templates/{id}**` 는 삭제된 템플릿도 반환(저장된 티어표·OG 정합). `SecurityConfig` **PATCH** 허용. 제목·설명·아이템명 등 길이 **100 / 10000** 계열 정합. DB: `**@ColumnDefault('ACTIVE')`** + `**docs/migrations/2026-03-29-tier-templates-status-default.sql**` → 컬럼명 정리 `**docs/migrations/2026-03-30-rename-status-columns.sql**`. **(2026-03-30)** 소유자만 PATCH/DELETE·삭제된 템플릿을 **새 파생·새 티어표 저장** 소스로 쓰지 못하게 **410 Gone** 처리.
- **프론트**: `template-edit-meta-modal` · `/templates` 케밥→모달 · `/tier` 헤더 케밥·**「이 템플릿을 바탕으로 새 템플릿 만들기」**는 `**tier-board`** 저장다운로드 줄 **왼쪽** · 삭제 확인 문구(소프트) · `export-modal` 등 **maxLength·한도 100/10000** 정리.
- `**/templates` 카드**: 설명 영역 **두 줄 분량 고정 높이**·푸터 `**h-11`** 로 줄 높이 고정.
- **보관**: **`progress/PROGRESS_20260329.md`**.

---

## `tier_results` 소프트 삭제·마이그레이션·공통 정책 **(2026-03-30)**

- **백엔드**: `ResultStatus` · `TierResult.result_status`. `**DELETE /api/v1/tiers/results/{id}`** 는 `**DELETE FROM` 없음** — `markDeleted()`로 `DELETED` + `**is_public = false`**. `**GET .../tiers/results**`(피드)·`**GET .../tiers/results/mine**`(내 티어표) 모두 `**ACTIVE`만** 반환; 삭제 후에도 **단건 `GET .../{id}`**·직접 URL·OG는 유지. 저장소: `findByUserIdAndResultStatusWithTemplateOrderByCreatedAtDesc` 등.
- **프론트**: `tier-api` `resultStatus` 파싱·응답 타입 · `tier-result-card` / `**/tier/result/[id]`** 삭제·삭제됨 표시 · `**tier-result-delete-confirm-dialog**` 문구(소프트·비공개·피드 숨김, 링크 유지). 삭제 성공 시 상세는 `**reloadResult**` 로 상태 반영.
- **마이그레이션 역할**: `**2026-03-30-rename-status-columns.sql`** 의 `tier_results` 블록은 `**status` 컬럼이 있을 때만** `result_status`로 RENAME — 원래 `status` 없던 DB는 **아무 컬럼도 안 생김**. 컬럼 **추가**는 `**2026-03-30-tier-results-result-status-soft-delete.sql`** (`ADD COLUMN IF NOT EXISTS`). 로컬은 `**ddl-auto: update**` 로 기동 시 컬럼이 생길 수 있어 DBeaver와 타이밍이 어긋날 수 있음.
- **공통 정책(에이전트·구현 참고)**: `**.cursor/rules/pickty-project-context.mdc`** — **「UGC·리소스 수정·삭제 정책」** — **수정**은 **본인만**(화면마다 수정 가능 필드 범위는 다를 수 있음) · **삭제**는 **본인 + `ROLE_ADMIN`** · 문맥상 **「삭제」** 기본 = **소프트 삭제** + **비공개** + **DB 레코드 유지**; 하드 삭제는 명시 시에만.

---

## 추천/비추천·템플릿 좋아요 UI **(2026-03-30)**

- `**ResultVoteButtons`** (`**frontend/src/components/interaction/result-vote-buttons.tsx**`): `**size="sm"**`(카드·피드 등) — **회색 비선택 없음**; 추천·비추천 **항상 빨강·파랑**(아이콘·숫자). `**size="lg"`**(`**/tier/result/…`** 상세) — 동일하게 **빨강·파랑 톤 고정**(옅은 테두리·배경); **내가 선택한 쪽만** 테두리 **글로우**(`box-shadow`)로 강조. 반응 **토글**은 `**/tier`**·`**/tier/result/…**` 만(`**useReactionsInteractiveSurface**`) — 그 외 경로는 수치만.
- `**TemplateLikeButton**`: `**appearance="plain"**` — 템플릿 **카드** 등 **테두리·글로우 없음**·핑크 글자 · `**boxed`** — 티어 보드 헤더 **라운드·보더**·선택 시 글로우(`**template-card.tsx`**는 `plain`). **(2026-03-31)** 상세는 위 **「진행 메모」** 절.

---

## 법무 웹 노출 · 약관 명칭 · 탈퇴 고지 **(2026-03-30 ~ 03-31)**

- **정본(단일)**: `**frontend/content/legal/TERMS_OF_SERVICE_KO.md`** · `**PRIVACY_POLICY_KO.md**` — `**read-legal-doc.ts**` 가 직접 읽음. 레포 루트에 동명 복본 두지 않음. 법적 주체 `**「서비스 제공자」**` 등 문구는 여기서만 수정. 공개 렌더 시 `**### (내부 참고)**` 이하 제거.
- **페이지**: `**/terms`** · `**/privacy**` — Server Component + `**react-markdown**` · `**remark-gfm**` · `**@tailwindcss/typography**`(`globals.css` `@plugin`).
- **링크**: 레이아웃 `**SiteFooter`**(전역) — **(2026-04-04)** `/login` 카드 내 중복 동의 문구는 푸터와 겹쳐 제거.
- **탈퇴 UX**: `**/account`** 회원 탈퇴 모달 — 개인정보 즉시 파기·**「서비스에 게시·작성하신 모든 콘텐츠」** 탈퇴 후 수정·삭제 불가·탈퇴 전 직접 삭제 안내 · 계정·연동 정보 복구 불가 한 줄.
- **(2026-03-31) 약관·개인정보처리방침 보강** (디시인사이드 벤치마킹·약관·방침 정합): `**TERMS_OF_SERVICE_KO.md`** — 제2조 **「비회원」**에 비회원 **댓글 등**에 **닉네임(또는 익명) 뒤 접속 IP 일부(예: 118.235) 화면 공개 표기**(건전한 운영·어뷰징 방지 취지) 명시; 제7조(금지)에 **자동화 수단(크롤링·스크래핑 등)으로 콘텐츠·메타데이터 무단 수집** 및 **AI 학습 등 사전 동의 없는 이용** 금지 보강. `**PRIVACY_POLICY_KO.md`** — 서두 **최소 수집·안전 처리** 쉬운 문장 추가; **2. 나. 비회원** 표에 **처리·이용 목적** 열·**IP 일부 마스킹 후 화면 노출**(이용약관 제2조와 동일 취지) 명시. 커밋: `docs: 이용약관 및 개인정보처리방침에 비회원 IP 노출 및 AI 크롤링 방어 조항 보강`.
- **(2026-03-31) 약관·방침 용어**: 제2조 **「서비스」**·**「콘텐츠」** 및 방침 **처리 목적**에서 **결과표·결과물** 제거 — 사용자 노출 용어 **티어표**·**템플릿**로 통일(위 **「제품 용어」**·**「진행 메모」** 와 맞춤).
- **보관**: `**progress/PROGRESS_20260330.md`**(당일 본문) · 위 **(2026-03-31)** 줄은 동 보관본에도 후속으로 요약됨.

---

## 모바일 타겟팅 · 저장 UX **(2026-03-27)**

- **문제**: 타겟팅 중 햄버거/저장 클릭 시 React 경고(다른 컴포넌트 렌더 중 store 갱신) 방지 + “해제만 vs 바로 동작” 일관성.
- **동작**: `**targetTierId !== null` 이면**  
  - 모바일 **햄버거**·데스크톱 **내 정보**: **메뉴/드롭다운은 열지 않고** `clearTarget` + `clearSelection` 만 (`useTierStore.getState()`로 호출 — `setState` 업데이터 안에서 이벤트 dispatch 금지).  
  - `**저장 | 다운로드`**: 모달 없이 동일 해제만. 둘째 탭부터 모달. 타겟 중에는 버튼에 `**active:scale-95` 미적용**(눌림 없이 해제만 느낌); 타겟 없을 때만 스케일.  
  - 상단 **타겟팅 토스트**가 사라지는 것이 첫 탭 피드백으로 충분하다는 합의.
- **캡처**: `**export-modal`** `generate()` 시작 시 `clearTarget`·`clearSelection` 후 **이중 `requestAnimationFrame`** 으로 리페인트 대기 → PNG에 보라 테두리·흐림 잔상 방지.

---

## 티어 — 비회원 자동 저장 플로우 **(2026-03-27)**

- **스토어**: `useTierStore`에 `**persist`(sessionStorage, `pickty-tier-board`)** — `tiers`·`pool`·`templateId`·`tierAutoSaveIntent`·자동 저장용 제목/설명 메타. `beginTierAutoSaveFlow` / `clearTierAutoSaveIntent` · 초기화 시 썸네일 스태시도 정리(`tier-autosave-thumbnail`).
- **썸네일**: 비로그인은 업로드 불가 → 모달 **미리보기 blob URL**을 Data URL로 `**sessionStorage`**(`pickty-tier-autosave-thumb-dataurl`)에 두고, `**runPersistedTierAutoSave`** 안에서 토큰으로 업로드 후 `createTierResult.thumbnailUrl` 설정(`thumbnailUrl: null`이면 백엔드가 첫 아이템 등 폴백).
- **라우팅**: `resolvePostOAuthTierFlow` — intent 있을 때 **PENDING** → `/signup/profile`만(API 저장 안 함) · **ACTIVE** → 즉시 저장·`**/tier/result/[id]`** · 실패 시 intent·스태시 정리 후 기본 `returnTo` 경로 + 토스트(로그인 페이지 등).
- **온보딩**: `signup/profile` 제출 성공 직후 intent 있으면 **온보딩 PATCH 다음** `runPersistedTierAutoSave` → 성공 시 `**/tier/result/[id]`**, 아니면 `/account`.
- **템플릿 재진입**: `tier-page-client` — persist 하이드 후 `**tierAutoSaveIntent` + URL `templateId` === 스토어 `templateId`** 이면 `**getTemplate`/`loadTemplateWorkspace` 생략**(로컬 이어쓰기).
- **하이드레이션**: `use-tier-persist-hydrated` — 템플릿 로드 effect가 persist 복원 전에 도는 것 방지.
- **메모**: 구글 프로필 이미지 `lh3.googleusercontent.com` **429** 는 CDN 레이트리밋 가능성 — 코드 이슈 아님, 재시도·캐시·(장기) 아바타 자체 호스팅 검토.

---

## OAuth · 로그인 흐름 (현행)

1. `**/login`** → `{API}/oauth2/authorization/{provider}` (팝업 또는 동일 탭).
2. 성공 시 Refresh **HttpOnly** 쿠키, `**/auth/callback?exchange=…`** → `**POST /api/v1/auth/oauth-exchange`** 로 Access JSON.
3. `**apiFetch**`: `credentials: 'include'` · 401 시 `**/auth/refresh**` · 로그아웃 `**POST /auth/logout**`.

---

## 기획 요약 (MVP ~ 확장)

- **Auth (확정)**: **소셜 전용** — 자체 이메일 가입/로그인 없음. 보관본 MVP 표의 이메일 문구는 기획 정리 시 삭제·수정 대상.
- **로드맵 (2026-04 조정)**: P0·P1·P2 1차 **완료**. **당면**: **P3 커뮤니티 게시판** — **다음**: **이상형 월드컵**(게시판 마무리 후). **스트리머·집계 티어표·멘션·알림** 등은 유저·수요 전 **공수 대비 효용 낮음**으로 **「장기 아이디어」**에 둠(보관본 기획·아키텍처는 참고용).
- **카테고리(분류) — YAGNI (아키텍처 확정, 2026-03-30)**  
  - **결정**: 현재 DB에 `category_id` 등 **분류 전용 컬럼을 미리 두지 않음**.  
  - **사유**: 초기 유저 데이터로 **어떤 주제의 티어표가 많이 올라오는지** 관찰한 뒤, **1-depth 카테고리**가 맞을지 **해시태그(Tag) 다대다**가 맞을지 **추후 결정**. 필요 시점의 **데이터 마이그레이션은 충분히 수행 가능**하다는 전제.
- **P3 커뮤니티 게시판·리치 에디터 (당면, 2026-03 기획 확정)**  
  - **에디터 스택**: **TipTap** 도입 예정 — React 컴포넌트 삽입·커스텀이 용이한 쪽으로 정함.  
  - **핵심 요구 기능**: (1) 본문에 **픽티 템플릿·티어표 URL**을 넣으면 **미리보기 카드(Link Card)** 로 렌더되거나, **모달에서 내 티어표 불러오기** 등으로 카드 삽입. (2) **유튜브 URL 붙여넣기 시 iframe 자동 임베드(재생)**.  
  - **착수 전제**: P2 1차·티어 허브 **현재 수준**에서 **바로 착수 가능**. 멘션·집계 티어표 등은 **「장기 아이디어」** — 게시판과 묶지 않음.
- **댓글 멘션(@)·글로벌 알림** — 정책 메모는 **「장기 아이디어」** 절로 이동(수요 전 보류).

---

## Phase 체크리스트 (요약)

### Phase 1 — 뼈대

- 소셜 OAuth · GNB · `/templates`·`/tier` · 월드컵 UI 비노출
- 로그아웃 — Refresh 무효화·블랙리스트(2026-03-26)

### Phase 2 — 기획

- Tier Maker 화면·백엔드 스펙·R2 (구현 기준 확정)
- **P2 커뮤니티·소셜** — 아래 「커뮤니티 확장」은 **이미 구현된 1차** + 역사적 기획 요약; **추가 확장·월드컵·스트리머**는 「장기 아이디어」.

### 커뮤니티 확장 (P2 로드맵) — **1차 구현 기준 요약** (확정·이력)

- **이미 있음 (1차)**: 좋아요·추천/비추천·댓글(익명·비번)·조회수 표시·인기 Top3 슬라이더 등 — 위 표·날짜 메모 참고.
- **당장 로드맵에 두지 않음**: 집계 티어표·댓글 멘션 UI·글로벌 알림·스트리머 — 상세 **「장기 아이디어」** 절. **월드컵**은 **(2026-04-20)** 1차 구현 **진행중**(표·「다음 작업」).

### Phase 3 — 구현

- 티어 템플릿·이미지·`tiers/results`·프론트(R2) — **진행됨**
- **P3 게시판** — **당면**(잔여: 수정·삭제·추천 등 — 표 참고)
- **이상형 월드컵** — **1차 진행중 (2026-04-20)** — 잔여·세부는 표·「다음 작업」·「진행 메모 (2026-04-20)」

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

1. ~~티어표 **제목·설명** 수정~~ → **완료 (2026-03-28)** — `/tier/my`·`/tier/result/[id]`·`/tier/feed` + PATCH API.
2. ~~**템플릿 역할·용어**~~ → **완료 (2026-03-30)** — `PROGRESS.md` 「제품 용어」·DB `**template_status`**·권한·삭제 템플릿 파생·`**tier_results` 저장** 차단 반영. 템플릿은 `**DELETED` 소프트 삭제** 한 가지(비공개 토글 없음); `**GET /templates/mine`은 `ACTIVE`만**이라 삭제된 템플릿은 본인 목록에서도 숨김. `**tier_results`** 는 `is_public` + 소프트 삭제가 별도(삭제 후에도 단건·링크·OG 정책은 API·화면 따름).
3. ~~**이미지 인프라(서버·CDN) 1차**~~ — **완료 (2026-03-31)** — API 이미지 프록시 **장기 캐시 헤더** · Next `**remotePatterns`**(`img.pickty.app` 등) 유지 + `**minimumCacheTTL` 1년** · 배포 체크리스트 **CF R2/CDN 가이드** · **(2026-03-30)** CF 대시보드 Cache Rule + `**curl` MISS→HIT** 운영 검증(아래 「배포·운영」). **Soft Launch 이후 선택**: R2 객체 메타 캐시·**파생 해상도**(썸네일 전용)·CF Images — 당장 필수 아님(프론트 WebP + CDN·브라우저 캐시로 1차 충분).

**그다음 (제품 — 2026-04 우선순위)**  
4. ~~**P2 커뮤니티 1차**~~ → **완료** — 반응·댓글·인기 Top3·조회수 등(본문 「진행 메모」). 추가 확장(집계 티어표·멘션 등)은 **「장기 아이디어」**.  
5. **P3 커뮤니티 게시판** — **진행중** — 1차(게시글 DB·작성/목록/상세 연동) 완료. 다음은 **수정**, **삭제(soft delete)**, **추천/비추천**, 작성/상세 **디테일 보완(UX·권한·예외 처리)**.  
6. **Ideal Type 이상형 월드컵** — **1차 구현 진행중 (2026-04-20)** — 템플릿 CRUD·플레이·통계·허브·에디터. **다음**: 유튜브 등 미디어 플레이 UI, 공개 여부 API, AI 연동 검토.  
7. **배포·운영** 지속 점검(`DEPLOYMENT-CHECKLIST`) · **Phase 5 Ops**(헬스 알림·Docker 재시작 정책 등 — MVP 이후 병행 가능).

**스트리머·집계 티어표·멘션·알림·R2 파생 이미지 등** — 전부 **「장기 아이디어」** (유저·수요 없이 공수만 드는 항목).

---

## 장기 아이디어·보류 **(수요·트래픽 전 — 공수 대비 효용 낮음)**

**P3 게시판**과 **그다음 이상형 월드컵**은 「다음 작업」·표 순서로 진행. **그 외**(집계·스트리머·멘션·알림·템플릿 유니버스 등)만 이 절에 두고 **당장 착수하지 않음**.

### AI 자동 템플릿 생성 파이프라인 (가칭 **AI 딸깍**) — **대기열/비용 방어 전제** *(일정 미정)*

- **목표 UX**: 사용자가 자연어로 요청(예: "블루아카이브 캐릭터 티어표 만들어줘")하면, **광고 30초 시청 대기열** 이후 AI가 **아이템 20개+이미지**를 자동 세팅해 `**/tier` 도화지에 즉시 배치 가능한 상태로 제공.
- **추가 생성 UX**: 1차 결과에서 이상한 사진은 사용자 수동 교체를 기본으로 하고, 원하면 광고 1회 추가 시청 후 **기존 목록 제외** 조건으로 20개를 추가 생성(append)하는 흐름을 검토.
- **백엔드 3단 파이프라인(기획)**:  
  1) **LLM 텍스트 단계** — 자연어 요청을 아이템명·검색 쿼리 목록으로 구조화  
  2) **Search API 단계** — Google Custom Search API로 이미지 URL 후보 수집  
  3) **Vision 단계** — Python 오픈소스 모델(또는 브라우저 `face-api.js`)로 핵심 객체 좌표 추출(`focusRect: { x, y, w, h }`).
- **프론트 렌더링 전략(비용 절감 핵심)**: 무거운 배경제거(누끼) 파이프라인은 도입하지 않고, `**TierItem**`에 `focusRect` 메타만 추가해 **CSS crop**으로 대응. 작은 카드(`item-card`계열)는 `object-fit: cover` + `object-position`으로 증명사진형 썸네일을 만들고, 확대 모달은 원본 이미지를 그대로 노출. **(완료)**
- **현재 코드 컨텍스트 연결**: `**frontend/src/lib/store/tier-store.ts**`의 `TierItem` 타입 확장 후보이며, `**frontend/src/components/tier/item-card.tsx**`는 현재 `TierItemTileImages`로 타일 렌더링하므로 `focusRect` 적용 시 공용 타일 렌더러 경로(`tier-item-tile-images`)까지 함께 설계해야 함.
- **의도/가드레일**: 이 아이디어의 1차 목적은 "유저 입력 1회로 바로 편집 가능한 템플릿 생성"이며, 인퍼런스 비용은 **광고 대기열 + 누끼 미도입 + 좌표 기반 크롭**으로 방어. 모델·API 비용, 품질 기준(부적절/오탐 이미지), 실패 시 폴백(수동 업로드 전환)은 별도 운영 정책으로 분리.

### 템플릿 유니버스 (가칭) — 파생 템플릿 조회 **(일정 미정)**

- **의도**: 템플릿 ID만 있을 때 조상 역추적 후 **루트 기준 전체 자손** 조회 등. **당장 할지 미정** — 설계 대비용.
- **현재 DB**: `tier_templates.parent_template_id` 인접 리스트 · `WITH RECURSIVE` 등 **기술적 가능성**만 기록.
- **규모 성장 시**: 인덱스·FK·재귀 쿼리·lineage 비정규화 등 검토.

### 집계 티어표·댓글 확장·알림

- **집계(평균) 티어표**: 다수 **배치 스냅샷** 취합 — **조회수 파이프와 무관**(「2026-04-05」).
- **댓글 멘션(@)**: 1-depth·입력창 자동 삽입 등 — 기존 기획은 보관본 참고.
- **글로벌 알림(🔔)**: 멘션 즉시 알림 **보류** — 회원 알림 인프라 후순위.
- **지표**: 조회수는 **표시용**으로 1차 완료; **인기 랭킹·GA4** 등 운영 정의는 수요 후.

### 스트리머 모드·대규모 트래픽 방어 **(기획만 확정)**

- **전제**: 바이럴·시청자 동시 제출 — Valkey **휘발성 집계**·TTL·명시적 저장 시 DB **귀속** 등(비회원 `sessionStorage` 자동 저장과 별개).
- **프론트**: 대기열 UI 대신 **가벼운 스피너**·지터 후 **자동 재시도**.
- **백엔드 Read**: `GET /templates/{id}` 등 **짧은 TTL 캐시**로 DB 보호(운영 시 적용 검토).
- **백엔드 Write**: 시청자 제출 **기본 휘발성** — 로그인 후 **「저장」** 시에만 DB 영구화.

### 기타

- R2 **파생 해상도**·Cloudflare Images·같은 **이미지 파이프 고도화** — 트래픽·비용 보고 후.

---

## 배포 · 운영

- nginx 443 → API. `**~/Pickty/deploy/lightsail/application-secrets.yaml`** 필수.
- `img.pickty.app` **403** vs API **404** 진단은 보관본 R2 절 또는 `LOCAL-DEV.md`.
- **Cloudflare 캐시 점검(재현)** **(2026-03-30)**: PowerShell에서는 `**curl.exe`** 사용. `KEY` = `GET https://api.pickty.app/api/v1/templates?size=1` JSON의 `thumbnailUrl` 마지막 경로세그먼트(예: `….webp`).  
`curl.exe -sI "https://api.pickty.app/api/v1/images/file/<KEY>"` 를 **연속 2회** — `**cache-control`** 에 `max-age=31536000`·`immutable` · `**cf-cache-status**` `MISS` → `HIT` 기대(`vary: Origin` 등은 응답에 따라 캐시 키 분리 가능).

---

## 마이그레이션·코드 맵


| 파일                                                                                                             | 메모                                                                                                          |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docs/migrations/2026-03-30-reactions-member-ip-hash-hybrid.sql`                                               | 회원 반응에도 `guest_ip_hash` 허용·`(target_type,target_id,guest_ip_hash)` 유니크는 `**user_id IS NULL**` 행만(NAT 충돌 방지) |
| `docs/migrations/2026-03-31-p2-community-unified.sql`                                                          | P2 `reactions`·`comments`·역정규화 카운트·게스트 반응 부분 유니크                                                            |
| `docs/migrations/2026-03-30-rename-status-columns.sql`                                                         | `tier_templates.status`→`template_status` · `tier_results.status`→`result_status`(있을 때만)                    |
| `docs/migrations/2026-03-25-p1-tier-template-user.sql`                                                         | P1 썸네일                                                                                                      |
| `docs/migrations/2026-03-26-users-merged-into-user-id.sql`                                                     | 병합                                                                                                          |
| `frontend/src/lib/pickty-upload-hint.ts`                                                                       | 이미지 업로드 UX 안내(브라우저 압축·다장 시 시간)                                                                              |
| `frontend/src/lib/pickty-image-url.ts`                                                                         | `resolvePicktyImageUrlForOpenGraph`, 표시용 URL                                                                |
| `frontend/src/lib/tier-result-opengraph.ts`, `template-opengraph.ts`                                           | OG fetch                                                                                                    |
| `frontend/src/components/tier/tier-board.tsx`, `export-modal.tsx`                                              | 타겟팅·캡처·비회원 자동 저장 CTA · 다운로드 시에만 워터마크                                                                        |
| `frontend/src/lib/tier-capture-png.ts`                                                                         | 클론 캡처 · `includeWatermark` · 미리보기/썸네일은 워터마크 off                                                             |
| `frontend/src/app/tier/tier-page-client.tsx`                                                                   | 템플릿 메타·공유·툴바 · intent 시 `getTemplate` 생략(덮어쓰기 방지)                                                           |
| `frontend/src/lib/store/tier-store.ts`                                                                         | Zustand + **sessionStorage persist**, `tierAutoSaveIntent`, `workspaceTemplate*`                            |
| `frontend/src/lib/post-oauth-tier-flow.ts`, `tier-autosave-thumbnail.ts`                                       | OAuth/온보딩 후 자동 저장·썸네일 스태시                                                                                   |
| `frontend/src/lib/hooks/use-tier-persist-hydrated.ts`                                                          | 티어 persist 하이드 대기                                                                                           |
| `frontend/src/app/login/page.tsx`, `auth/callback/page.tsx`, `signup/profile/page.tsx`                         | `resolvePostOAuthTierFlow` 연동                                                                               |
| `frontend/src/components/layout/gnb.tsx`                                                                       | 모바일/내 정보 + 타겟 시 1차 클릭 해제 · **템플릿** / **티어표** 내비 · 계정 메뉴 **내 템플릿**                                           |
| `frontend/src/app/templates/mine/page.tsx`, `frontend/src/components/template/template-card.tsx`               | **내 템플릿** 목록·카드 공통 컴포넌트                                                                                     |
| `frontend/src/app/tier/feed/page.tsx`                                                                          | 글로벌 피드·무한 스크롤                                                                                               |
| `frontend/src/components/tier/tier-result-card.tsx`                                                            | 내 티어표·피드 공통 카드(수정/삭제/리믹스 권한)                                                                                |
| `frontend/src/components/tier/tier-result-edit-meta-modal.tsx` 등                                               | 티어표 메타 PATCH 모달·삭제 확인                                                                                       |
| `backend/.../domain/tier/TierResultController.kt` 등                                                            | `tiers/results` POST/GET/PATCH/DELETE·**GET 페이징 목록**·`SecurityUtils`·`SecurityConfig`                       |
| `backend/.../domain/tier/`, `upload/`                                                                          | 템플릿·`tier_results`·R2·`ImageUploadController`                                                               |
| `backend/.../domain/interaction/`, `frontend/src/lib/api/interaction-api.ts`, `frontend/src/components/interaction/` | P2 반응·댓글 API·UI                                                                                             |
| `backend/.../interaction/interactionMyReactionService.kt`, `frontend/src/lib/store/reaction-store.ts`              | 로그인 `**myReaction`** bulk · 비회원 반응 `**localStorage**`                                                       |


**구현 세부**(DnD N차 등)는 `**progress/PROGRESS_20260327.md`** 참고.

---

