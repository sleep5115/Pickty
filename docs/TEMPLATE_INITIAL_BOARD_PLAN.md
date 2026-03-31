# 템플릿 초기 보드·라벨 커스텀 — 코드베이스 분석 및 구현 계획

> 목적: 템플릿 생성자가 **도화지(보드 배경 + 티어 행 정의)** 를 고정하고, `/tier?templateId=…` 진입 시 **다크/라이트 테마 기본값보다 우선** 적용한다.  
> 전제: `POST /api/v1/images` + `uploadPicktyImages` 재사용.

---

## 현재 구현 요약 (분석)

### 백엔드

- **`tier_templates`**: `items` 컬럼 하나의 **JSONB**에 `description` + `items[]`(풀 아이템)만 저장 (`TierTemplate.kt`, `templateItemsPayloadToMap`).
- **생성**: `CreateTemplateRequest` → `TemplateItemsPayload` + `thumbnailUrl` 등 (`TierDtos.kt`).
- **조회**: `TemplateDetailResponse`가 **전체 `items` Map**을 그대로 반환 (`TierTemplateService.getById`).

### 프론트엔드

- **`tier-store.ts`**
  - 행: `tiers: Tier[]` — `label`, `color`, `backgroundUrl?`, `items`.
  - 기본 행: `INITIAL_TIERS` (S~E 고정 색, 빈 `items`).
  - **`loadTemplateWorkspace`**: 풀만 API에서 채우고 **`tiers`는 항상 `INITIAL_TIERS` 복제(빈 행)** — 템플릿이 행 구성을 줄 수 없음.
  - **`resetBoard`**: 아이템만 모아 풀에 두고 **`tiers`를 다시 `INITIAL_TIERS`** 로 되돌림.
  - **persist**(sessionStorage): `templateId`, `tiers`, `pool`, 자동저장 intent 등 — **전역 보드 배경 필드는 아직 없음**.
- **`tier-page-client.tsx`**: `getTemplate` → `templatePayloadToTierItems` → `loadTemplateWorkspace` — 행 초기화는 위와 동일.
- **`tier-board.tsx`**: 캡처 영역이 `bg-white dark:bg-zinc-900` — 테마에 따라 보드 배경이 바뀌어 **템플릿별 일관성이 깨질 수 있음**.
- **스냅샷** (`tier-snapshot.ts`): 저장 시 `tiers`/`pool` 전체가 들어가므로 **행 색·라벨·행 배경 URL**은 결과 저장에 이미 포함됨. 부족한 것은 **템플릿에서의 초기 주입**과 **보드 전체 배경**.
- **이미지 업로드**: `uploadPicktyImages` (`image-upload-api.ts`) — 압축 후 파일마다 `POST /api/v1/images`. **`TierSettingsModal`** 이 행 배경에 동일 API를 직접 호출하는 패턴이 이미 있음.

### 타입 위치

- 별도 `frontend/src/types/` 티어 전용 트리는 없음. **`Tier` / `TierItem`** 은 `@/lib/store/tier-store`, 스냅샷은 `@/lib/tier-snapshot.ts`.

---

## 1. DB 스키마 및 Entity — `board_config` JSONB 컬럼

### 결론: **별도 `board_config` JSONB 컬럼 추가를 권장**

| 접근 | 장점 | 단점 |
|------|------|------|
| **`board_config` JSONB (신규 컬럼)** | 풀 아이템(`items`)과 **관심사 분리**; `null` = “기본 도화지(현행 INITIAL_TIERS + 테마 배경)” 명확; PATCH 확장 시 필드 경계가 분명 | 마이그레이션·엔티티 필드 1개 추가 |
| 기존 `items` JSON에 키만 추가 | 마이그레이션 없이 스키마 확장 가능 | `items`가 “아이템 목록 + 메타” 혼합; `applyTemplateMeta`·요약 카운트 등과 **같은 Map**을 계속 건드림; 검증·문서화가 지저분해지기 쉬움 |

**권장 스키마(예시, 버전 필드 권장):**

```json
{
  "schemaVersion": 1,
  "board": {
    "backgroundColor": "#1a1a1a",
    "backgroundUrl": "https://img.pickty.app/....webp"
  },
  "rows": [
    { "id": "tier-uuid-or-stable-id", "label": "S", "color": "#FF7F7F", "backgroundUrl": null }
  ]
}
```

- **보드 배경**: `backgroundColor` **또는** `backgroundUrl` 중 하나 우선 규칙을 프론트·백 모두에 동일하게 정의 (예: URL이 있으면 URL 우선, 없으면 색, 둘 다 없으면 테마 기본).
- **행 `id`**: 프론트 `Tier.id`와 동일하게 **안정적인 문자열**을 저장해야 `/tier` 재진입·persist와 맞물림. 신규 행은 클라이언트에서 `newTierRowId()`와 동일 규칙으로 생성해 저장하면 됨.
- **백엔드 검증**: `@Valid`용 Kotlin data class + 행 개수 상한(예: 2~20), `label` 길이(기존 UI: CJK 3 / ASCII 5에 맞춤), `color` Hex, `backgroundUrl` `@Size(max=2048)` 및 `normalizeThumbnailUrl`과 동일한 **https 허용** 정책.

### Entity / DTO 수정 방향

1. **`TierTemplate`**: `@JdbcTypeCode(SqlTypes.JSON) var boardConfig: Map<String, Any?>? = null` (컬럼명 `board_config`, **nullable**).
2. **`CreateTemplateRequest`**: `val boardConfig: TemplateBoardConfigPayload? = null` (또는 nested DTO; null이면 서버에서 DB에 null 저장).
3. **`TemplateDetailResponse`**: `val boardConfig: Map<String, Any?>?` 추가 — 메이커·OG·캐시 일관성.
4. **`TemplateSummaryResponse`**: 목록 카드에 필수는 아님; 썸네일·제목만 쓰면 **생략 가능**(응답 크기 절약).
5. **`fork` 생성 시**: 부모의 `boardConfig`를 **복사**할지 제품 정책으로 결정(권장: **복사** 후 편집 가능).
6. **`PATCH` 템플릿 메타**: 현재는 제목·설명만. 도화지 수정을 **같은 PATCH**에 넣을지, **`PATCH …/templates/{id}/board`** 를 둘지 선택 — 1차는 **생성 시에만** 넣고 PATCH는 후속 작업으로 나누어도 됨.

---

## 2. 프론트엔드 Store — 상태 관리와 초기값 주입

### 현재

- 테마: **전역 CSS(`dark:`)** 에 의존; 스토어에 “라이트/다크” 플래그 없음.
- 행: `INITIAL_TIERS`가 **단일 기준선**; 템플릿은 풀만 제공.

### 제안 구조

1. **스토어에 “템플릿이 준 도화지”를 보관** (이름 예시):
   - `templateBoardDefaults: { board: …; rows: Tier[] } | null`
   - 또는 `boardBackground: { color?: string; url?: string } | null` + `defaultTiers: Tier[] | null` 로 분리.
2. **`loadTemplateWorkspace` 시그니처 확장**  
   - 인자에 `initialTiers?: Tier[]`, `initialBoardSurface?: { color?: string; url?: string }` (또는 `boardConfig` 원본 객체) 추가.  
   - `initialTiers`가 있으면: **빈 `items[]`로 복제**해 풀과 ID 충돌 없이 주입(현재 `INITIAL_TIERS.map`과 동일 패턴).  
   - 없으면: 기존처럼 `INITIAL_TIERS`.
3. **`resetBoard` 동작 변경**  
   - `templateBoardDefaults`가 있으면: 티어 행 구조·라벨·색·행 배경은 **그 스냅샷으로**, 아이템만 풀로 되돌림.  
   - 없으면: 기존 `INITIAL_TIERS` 유지.
4. **persist `partialize`**  
   - 템플릿에서 온 **보드 배경·기본 행 메타**가 세션 이어가기에 필요하면 `templateBoardDefaults` 또는 파생 필드만 골라 저장.  
   - 단, **이미 `tiers`에 사용자가 배치한 내용**이 persist되므로 “초기값만” 별도 키로 두는 편이 **`resetBoard`·재진입**에 안전함.
5. **테마보다 우선**  
   - `TierBoard` 캡처 루트: `boardBackgroundUrl`이 있으면 `background-image` + `picktyImageDisplaySrc`; 색만 있으면 `style={{ backgroundColor }}`; 둘 다 없으면 기존 `bg-white dark:bg-zinc-900`.

### `tierAutoSaveIntent` + 동일 `templateId` 재진입

- 기존처럼 서버 로드를 스킵할 때도, **첫 진입 시 이미 스토어에 심어 둔 `templateBoardDefaults`** 가 있어야 초기화·리셋이 일관됨.  
- 필요 시 persist에 `templateBoardDefaults` 포함.

---

## 3. 이미지 업로드 재사용성

- **핵심 로직**: **`uploadPicktyImages`** 그대로 사용하면 됨 (배경·라벨 행 배경 모두 동일 R2 파이프).
- **`TierSettingsModal`**: 행 배경용 `<input type="file">` + 로그인 체크 + `PICKTY_IMAGE_ACCEPT` / `PICKTY_IMAGE_UPLOAD_HINT` 패턴이 **참고 구현**이다.
- **별도 Wrapper**: 필수는 아님. 다만 템플릿 생성 화면(`/template/new`)과 보드 설정에서 **중복을 줄이려면** 작은 훅 `usePicktyImageUploadField({ onUrl })` 또는 컴포넌트 `PicktyImageUploadButton` 정도면 충분 (내부에서만 `uploadPicktyImages([file], token)` 호출).

**주의**: 리스트 썸네일·아이템 이미지와 동일하게 **로그인 필요** 정책이면, 비로그인 템플릿 작성 플로우가 없다는 전제와 맞는지 확인 (`TierSettingsModal`과 동일).

---

## 4. 단계별 To-Do (작업 순서)

### A. 백엔드

1. **마이그레이션 SQL** (`docs/migrations/…sql`):  
   `ALTER TABLE tier_templates ADD COLUMN IF NOT EXISTS board_config jsonb NULL;`  
   (필요 시 코멘트·향후 GIN 인덱스는 쿼리 패턴 생길 때만.)
2. **`TierTemplate` 엔티티**: `boardConfig` 필드 매핑.
3. **DTO**:  
   - `TemplateBoardConfigPayload` / 행 DTO + Bean Validation.  
   - `CreateTemplateRequest`에 `boardConfig` 옵션.  
   - `TemplateDetailResponse`(및 필요 시 `TemplateResponse`)에 `boardConfig` 포함.
4. **`TierTemplateService.create`**: 요청 병합 → 엔티티 저장; `templateItemsPayloadToMap`과 **독립** 유지.
5. **Fork**: 부모 `boardConfig` 복사 여부 구현 및 테스트.
6. **(선택)** `UpdateTemplateMetaRequest` 확장 또는 전용 PATCH로 `boardConfig` 수정 + 권한(소유자/ADMIN) 동일.

### B. 프론트 — 타입·파싱

7. **`tier-api.ts`**: `TemplateDetailResponse`에 `boardConfig?: …` 타입 추가; `getTemplate` 파싱.
8. **매퍼**: `parseTemplateBoardConfig(raw): TemplateBoardDefaults | null` — `schemaVersion`·행 배열 검증 실패 시 `null` (안전 폴백).
9. **공유 타입**: `tier-store.ts` 또는 `lib/template-board-config.ts`에 프론트 전용 타입 정의(Zod 선택).

### C. 프론트 — Store·페이지

10. **`tier-store`**: `templateBoardDefaults`, `loadTemplateWorkspace`/`resetBoard`/`hydrateFromResultSnapshot` 정책 정리(결과 스냅샷 우선 vs 템플릿 도화지 — **리믹스/소스 결과**는 기존 스냅샷이 이미 전체 보드를 가짐).
11. **`tier-page-client`**: `getTemplate` 후 `boardConfig` 파싱 → `loadTemplateWorkspace`에 전달.
12. **`TierBoard` (및 readonly 변형)**: 보드 루트 배경 스타일 분기; 캡처 PNG에도 동일 배경이 잡히도록 `captureRef` 계층 정리.

### D. 프론트 — 템플릿 생성 UI

13. **`/template/new`**: 도화지 섹션 — 보드 배경(색/이미지 업로드), 행 추가·삭제·라벨·색·행 배경(기존 모달 로직 재사용 또는 간소화 폼).
14. **`createTemplate` 페이로드**에 `boardConfig` 포함; Zod 스키마 확장.
15. **Fork 프리필**: `getTemplate`으로 부모 `boardConfig`·아이템 로드 시 폼 초기값 반영.

### E. 검증·문서

16. **E2E/수동**: `/tier?templateId=` 라이트·다크 전환 시 보드 배경·라벨 일관성, `resetBoard`, sessionStorage 새로고침, 저장 스냅샷에 보드 배경 포함 여부(요구 시 **스냅샷 스키마 v2**에 `board` 필드 추가 검토).
17. **`PROGRESS.md`**: 기능 요약 한 줄 반영.

---

## 스냅샷·스키마 버전 (참고)

- 지금 `TIER_SNAPSHOT_SCHEMA_VERSION = 1`은 `tiers`/`pool`만 있음.  
- “저장된 티어표”에도 **보드 전체 배경**을 고정하려면 `TierSnapshotPayload`에 `board?` 를 넣고 **버전 2**로 올리는 것이 깔끔하다.  
- **템플릿 초기값만** 문제라면 1차에서는 **메이커 UI + 템플릿 `board_config`** 만으로도 요구사항 1·2를 충족할 수 있고, 스냅샷 확장은 후속으로 분리 가능.

---

## 요약 답변 (체크리스트)

| 질문 | 답 |
|------|----|
| JSONB `board_config` 컬럼 적절성? | **적절함.** 풀 아이템 JSON과 분리하는 편이 유지보수·검증에 유리. |
| Store 초기값 주입? | `loadTemplateWorkspace`에 **초기 행 + 보드 배경** 전달; **`templateBoardDefaults` + `resetBoard` 기준선**으로 템플릿 고정. |
| 이미지 업로드? | **`uploadPicktyImages` + 기존 모달 패턴 재사용**; 필요 시 얇은 훅/버튼 컴포넌트만. |
| 타입 폴더? | 현재는 `tier-store`·`tier-snapshot` 중심; 새 파일 `lib/template-board-config.ts` 권장. |

---

## 관련 후속 문서

- **템플릿 만들기 화면의 도화지·미리보기(구현 상세·저장 필드·레이어)**: [`TEMPLATE_NEW_CANVAS_AND_PREVIEW.md`](./TEMPLATE_NEW_CANVAS_AND_PREVIEW.md)
