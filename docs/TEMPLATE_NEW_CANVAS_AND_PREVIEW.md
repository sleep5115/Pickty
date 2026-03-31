# 템플릿 만들기(`/template/new`) — 도화지·미리보기

> **작성 시점**: 2026-03-31. 이 화면의 **캔버스(도화지)** 와 **하단 미리보기** 동작·데이터 흐름·레이어 규칙을 한곳에 정리한다.  
> **다음 작업(제품)**: 표 전체에 **이미지뿐 아니라 배경색**을 넣는 UI·저장(아래 「다음 작업」).

---

## 1. 화면 구성

| 영역 | 컴포넌트·역할 |
|------|----------------|
| 폼 | 제목·설명·아이템(이미지) 등 — 템플릿 본문 |
| **도화지** | `TemplateBoardCanvasEditor` — 표 배경(현재 **이미지 업로드 중심**), S~E 행 라벨·행 이미지·행 추가·**기본 세팅** |
| **미리보기** | `TierBoard` `variant="template-preview"` — 같은 `tier-store`의 `tiers`·`workspaceBoardSurface`·`pool`로 **실제 배치 DnD** 체험 |
| 톱니바퀴 | `TierSettingsModal` — 라벨 문구·**라벨 배경색**·글자색·행 누끼 이미지·「누끼 뒤 매트」 등 |

미리보기 풀은 폼 아이템과 맞추기 위해 `syncTemplatePreviewPoolFromForm(formTierEntries)` 로 주기적으로 동기화된다.

---

## 2. 도화지 (`TemplateBoardCanvasEditor`)

**파일**: `frontend/src/components/template/template-board-canvas-editor.tsx`

### 2.1 표(보드) 전체 배경

- 스토어: `workspaceBoardSurface: TemplateBoardSurface | null` (`backgroundColor?`, `backgroundUrl?`).
- **렌더**: 절대 위치 레이어에 `surfaceStyle` — `backgroundColor`·`backgroundImage`(cover) 동시 지원.
- **현재 UX**: 가운데 영역 탭으로 **이미지 업로드**(`uploadPicktyImages`). 이미지 제거 시, 남아 있는 `backgroundColor`만 있으면 그걸로 유지.
- **미구현(다음 작업)**: 사용자가 **색만** 고르는 컨트롤(컬러 피커·프리셋) — 스키마·스토어는 이미 `board.backgroundColor` 를 받을 수 있음.

### 2.2 z-index·포인터(이벤트)

- **배경만**: `z-[10]` — 표 뒤 깔림.
- **업로드 타깃(label)**: `z-[20]` — 행 레이어가 `pointer-events-none` 이라 가운데 클릭이 여기로 떨어짐.
- **행 줄**: `z-[30]` — 라벨 칸·우측 ⚙·드래그 핸들만 `pointer-events-auto`.

### 2.3 행·라벨 칸 (`CanvasEditorLabelCell`)

- **라벨 이미지 있음**: `TierLabelCellView` 전체 표시, 호버 시 수정/삭제.
- **라벨 이미지 없음**: 업로드 유도 버튼이되, **`getTierLabelSolidCellStyle` / `getTierLabelTextStyle`** 로 미리보기·`TierLabelCellView` 와 동일 규칙으로 **라벨 배경색·글자색** 반영(`showLabelColor` 등). 예전에는 항상 투명+점선만 그려서 모달 적용 직후 도화지에 색이 안 보이는 버그가 있었음.

### 2.4 기본 세팅 버튼

- 문구: **「기본 세팅」** (도화지 설명 **아래** 배치).
- 동작: `initTemplateBoardEditor(createDefaultTemplateBoardConfig({ revealLabelColors: true }))` 후 `syncTemplatePreviewPoolFromForm(...)`.
- 신규 진입 기본 행은 `createDefaultTemplateBoardConfig()` — 행마다 **`showLabelColor: false`** 로 두고 `color` 는 S~E 파스텔 hex 유지 → **미리보기·도화지에서 라벨 칸은 투명**, 표 배경만 비침. **기본 세팅** 누르면 파스텔 라벨이 다시 보임.

### 2.5 행 추가

- `addTierRow` — 신규 행은 `showLabelColor: false` 등 기본값.

---

## 3. 미리보기 (`TierBoard` `template-preview`)

**파일**: `frontend/src/components/tier/tier-board.tsx` 등.

- **데이터 소스**: `useTierStore` 의 `tiers`, `pool`, `workspaceBoardSurface` — 도화지와 **동일 스토어**이므로 톱니바퀴 적용·캔버스 업로드가 **즉시** 미리보기에 반영된다.
- **풀 동기화**: 폼에만 있는 아이템을 풀에 올리기 위해 `syncTemplatePreviewPoolFromForm` — 미리보기에서 DnD할 카드 후보와 폼이 어긋나지 않게 함.

---

## 4. 라벨 렌더·레이어 (`TierLabelCellView` / `tier-label-surface`)

**파일**: `tier-label-cell-view.tsx`, `tier-label-surface.ts`

### 4.1 의도한 스택(아래→위)

1. **표 배경** (부모·보드 한 겹)  
2. **라벨 단색 / 누끼 아래 매트** (`tier.color`) — 조건부  
3. **라벨 행 이미지** (`backgroundUrl`)  
4. **라벨 글자**

### 4.2 플래그

| 필드 | 의미 |
|------|------|
| `showLabelColor` | `false` 이면 라벨 칸에 `color` 단색·누끼 매트 **미적용**(표 배경만). **필드 없음** = 구 데이터·`/tier` 기본 → 예전처럼 색 **표시**. |
| `paintLabelColorUnderImage` | 행 이미지 있을 때, 누끼 투명 구간 아래에 `color` 깔지. `undefined` → 기본 **켬**. 이미지 **없을 때** 모달 적용으로 `false`만 저장하면, 나중에 이미지 추가 후에도 매트가 꺼진 채로 남아 표 배경이 비치는 버그가 있었음 → **이미지 없을 때는 `undefined` 저장**, 첫 이미지 업로드 시 잘못 남은 `false` 는 `shouldResetPaintMatWhenAddingFirstLabelImage` 로 정리. |

### 4.3 톱니바퀴 모달 (`TierSettingsModal`) 요약

- 라벨 배경 탭: 팔레트에서 **선택 강조(링)** 는 끔 — 글자색 탭만 유지.
- 같은 hex 재선택(첫 프리셋 등): `labelBgPaletteInteracted` 로 **미리보기·적용 시** `showLabelColor` 켜짐 처리.
- 적용 시 `paintLabelColorUnderImage`: 행 이미지 있으면 체크박스 값, **없으면 `undefined`**.

---

## 5. 저장·불러오기 (`board_config`)

### 5.1 프론트 타입·검증

- `frontend/src/lib/template-board-config.ts` — Zod `parseTemplateBoardConfig`, `createDefaultTemplateBoardConfig`, `buildTemplateBoardConfigFromEditorState`, `templateBoardConfigToApiPayload`, `cloneTemplateBoardConfig`.

### 5.2 API 페이로드(요약)

- `schemaVersion: 1`, `board?` (`backgroundColor`, `backgroundUrl`), `rows[]` (`id`, `label`, `color`, `textColor`, `paintLabelColorUnderImage`, `showLabelColor`, `backgroundUrl` 등 null 허용 필드).

### 5.3 백엔드

- DB: `tier_templates.board_config` JSONB.
- 생성 시: `TierTemplateService.templateBoardConfigPayloadToMap` — 행에 `textColor`, `paintLabelColorUnderImage`, `showLabelColor` 등 **맵에 포함**(DTO 확장됨). Fork 시 부모 맵 복제.

### 5.4 복잡도·회귀 체크 메모

- 저장 경로가 **프론트 빌드 → Kotlin DTO → JSONB** 로 이어지므로, **새 행 필드 추가 시** 반드시 **양쪽 매핑**을 같이 갱신할 것.
- 수동 스모크: (1) 표 배경 이미지 (2) 라벨 배경색만 (3) 라벨 누끼 추가 후 레이어 (4) 저장 → 새로고침 또는 템플릿 다시 열기 → `board_config` 복원.

---

## 6. 다음 작업

- **표(보드) 배경색 UI**: `workspaceBoardSurface.backgroundColor` / `board_config.board.backgroundColor` 는 이미 모델에 있으나, 도화지에서 **이미지 없이 색만** 고르는 플로우(피커·프리셋·제거)를 추가하고, 저장 페이로드·미리보기·`/tier` 로드와 시각적으로 일치시키기.

---

## 7. 배포

- 위 **다음 작업(표 배경색)** 까지 반영·검증한 뒤 **배포** 진행(브랜치 `dev` → `main` 등 기존 규칙·`docs/DEPLOYMENT-CHECKLIST.md` 참고).

---

## 8. 관련 파일 빠른 목록

| 경로 | 내용 |
|------|------|
| `frontend/src/app/template/new/page.tsx` | 도화지·미리보기 배치, 제출 시 `boardConfig` |
| `frontend/src/components/template/template-board-canvas-editor.tsx` | 도화지 UI |
| `frontend/src/components/tier/tier-settings-modal.tsx` | 톱니바퀴 |
| `frontend/src/components/tier/tier-label-cell-view.tsx` | 라벨 칸 공용 렌더 |
| `frontend/src/lib/tier-label-surface.ts` | 단색·글자 스타일, 매트 리셋 헬퍼 |
| `frontend/src/lib/template-board-config.ts` | board_config 타입·Zod·빌드 |
| `frontend/src/lib/store/tier-store.ts` | `tiers`, `workspaceBoardSurface`, `initTemplateBoardEditor`, … |
| `backend/.../TemplateBoardConfigDtos.kt` | 행 DTO |
| `backend/.../TierTemplateService.kt` | `templateBoardConfigPayloadToMap` |
| `docs/TEMPLATE_INITIAL_BOARD_PLAN.md` | 초기 설계·DB 방향(참고) |
