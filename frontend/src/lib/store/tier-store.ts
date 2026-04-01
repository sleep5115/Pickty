import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import { clearTierAutoSaveThumbnailStash } from '@/lib/tier-autosave-thumbnail';
import {
  cloneTemplateBoardConfig,
  type TemplateBoardConfig,
  type TemplateBoardSurface,
} from '@/lib/template-board-config';

export interface TierItem {
  id: string;
  name: string;
  imageUrl?: string;
}

/** 기획·문서에서 쓰는 이름과 동일 — 티어 아이템 타입 */
export type PicktyItem = TierItem;

export interface Tier {
  id: string;
  label: string;
  /** 라벨 칸 배경색(이미지 뒤에도 깔림) */
  color: string;
  /** 라벨 글자색 — 없으면 `getTierLabelTextStyle`이 대비색 사용 */
  textColor?: string;
  /**
   * 행 배경 이미지가 있을 때만 의미 있음.
   * true면 누끼 아래에 `color` 단색 레이어, false/미설정이면 표 배경이 투명 구간에 비침.
   */
  paintLabelColorUnderImage?: boolean;
  /**
   * false면 라벨에 `color` 단색/매트 미표시(표 배경만). 도화지 초기·신규 행은 false, 구 저장본은 필드 없음=true 취급.
   */
  showLabelColor?: boolean;
  /** R2 등 업로드 URL — 렌더 시 `picktyImageDisplaySrc` 경유 권장 */
  backgroundUrl?: string;
  items: TierItem[];
}

/** 풀 순서 → 티어 행 위에서 아래, 각 행 왼→오. 이미지 URL 있는 아이템만 (확대 갤러리 순서). */
export function buildTierImageGallery(state: {
  pool: TierItem[];
  tiers: Tier[];
}): TierItem[] {
  const hasImage = (it: TierItem) => Boolean(it.imageUrl?.trim());
  return [
    ...state.pool.filter(hasImage),
    ...state.tiers.flatMap((t) => t.items.filter(hasImage)),
  ];
}

const INITIAL_TIERS: Tier[] = [
  { id: 'S', label: 'S', color: '#FF7F7F', textColor: '#111827', items: [] },
  { id: 'A', label: 'A', color: '#FFBF7F', textColor: '#111827', items: [] },
  { id: 'B', label: 'B', color: '#FFDF7F', textColor: '#111827', items: [] },
  { id: 'C', label: 'C', color: '#BFFF7F', textColor: '#111827', items: [] },
  { id: 'D', label: 'D', color: '#7FFF7F', textColor: '#111827', items: [] },
  { id: 'E', label: 'E', color: '#7FFFFF', textColor: '#111827', items: [] },
];

/** 비보안 HTTP(예: LAN IP)에서는 crypto.randomUUID()가 없거나 throw — 모바일 로컬 테스트 대응 */
function newTierRowId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') {
      return `tier-${c.randomUUID()}`;
    }
  } catch {
    // Secure Context가 아닐 때 randomUUID 사용 불가
  }
  return `tier-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const INITIAL_POOL: TierItem[] = [];

function emptyTiersFromBoardConfig(cfg: TemplateBoardConfig): Tier[] {
  return cfg.rows.map((r) => ({
    id: r.id,
    label: r.label,
    color: r.color,
    ...(r.textColor?.trim() ? { textColor: r.textColor.trim() } : {}),
    ...(typeof r.paintLabelColorUnderImage === 'boolean'
      ? { paintLabelColorUnderImage: r.paintLabelColorUnderImage }
      : {}),
    ...(typeof r.showLabelColor === 'boolean' ? { showLabelColor: r.showLabelColor } : {}),
    ...(r.backgroundUrl ? { backgroundUrl: r.backgroundUrl } : {}),
    items: [],
  }));
}

interface TierState {
  /** 서버 템플릿 UUID — 없으면 첫 서버 저장 시 템플릿 생성 */
  templateId: string | null;
  /** 메이커 상단에 표시 — API 템플릿 제목·설명(플레이 중인 템플릿) */
  workspaceTemplateTitle: string | null;
  workspaceTemplateDescription: string | null;
  tiers: Tier[];
  pool: TierItem[];
  selectedItemIds: string[];
  targetTierId: string | null;
  /** 이미지 확대 모달에 표시할 아이템 */
  previewItem: PicktyItem | null;

  /**
   * 현재 템플릿의 서버 도화지 스냅샷 — `resetBoard` 시 행·라벨·색·행 배경 복원용.
   * 없으면 `INITIAL_TIERS` 기준.
   */
  templateBoardDefaults: TemplateBoardConfig | null;

  /**
   * 표 전체 배경 — `null`이면 캡처 영역은 테마 기본(`bg-white` / `dark:bg-zinc-900`).
   * 템플릿 도화지·`/tier` 템플릿 로드 시 `board_config.board`와 동기화.
   */
  workspaceBoardSurface: TemplateBoardSurface | null;

  /**
   * 로그인·가입 직후 자동 저장 플로우 (sessionStorage persist).
   * `intent: 'auto_save'` 요구사항에 대응하는 플래그.
   */
  tierAutoSaveIntent: boolean;
  autoSaveListTitle: string | null;
  autoSaveListDescription: string | null;

  /** 소셜 로그인 직전 호출 — 스토어가 persist 되도록 한 틱 남김 */
  beginTierAutoSaveFlow: (meta?: { listTitle?: string | null; listDescription?: string | null }) => void;
  clearTierAutoSaveIntent: () => void;

  toggleTargetTier: (tierId: string) => void;
  clearTarget: () => void;

  toggleItemSelection: (itemId: string) => void;
  selectItems: (itemIds: string[]) => void;
  clearSelection: () => void;

  /**
   * toTierId: 'pool' 또는 tier의 id
   * 이미 대상 위치에 있는 아이템은 자동으로 무시됨
   */
  moveItems: (itemIds: string[], toTierId: string | 'pool') => void;

  /** 티어 행 순서 변경 (dnd-kit arrayMove) */
  reorderTiers: (activeId: string, overId: string) => void;

  /** 특정 티어의 label / color / 배경 이미지 변경 */
  updateTier: (
    tierId: string,
    updates: {
      label?: string;
      color?: string;
      textColor?: string | undefined;
      paintLabelColorUnderImage?: boolean;
      showLabelColor?: boolean;
      backgroundUrl?: string | undefined;
    },
  ) => void;

  /** 선택한 행의 위 또는 아래에 빈 티어 행 추가 */
  addTierRow: (nearTierId: string, position: 'above' | 'below') => void;

  /** 행 삭제 — 해당 행 아이템은 Pool로 반환 */
  deleteTierRow: (tierId: string) => void;

  /** 행 비우기 — 행은 유지하고 아이템만 Pool로 반환 */
  clearTierRow: (tierId: string) => void;

  resetBoard: () => void;
  setTemplateId: (id: string | null) => void;

  /** 서버 템플릿으로 풀 교체 — `boardConfig` 있으면 해당 행으로, 없으면 S~E */
  loadTemplateWorkspace: (payload: {
    templateId: string;
    pool: TierItem[];
    workspaceTemplateTitle?: string | null;
    workspaceTemplateDescription?: string | null;
    boardConfig?: TemplateBoardConfig | null;
  }) => void;

  setWorkspaceTemplateMeta: (meta: { title?: string | null; description?: string | null }) => void;

  /**
   * 저장된 티어 결과 스냅샷으로 보드 전체 복원(리믹스).
   * POST 저장 시에는 항상 새 row가 되며 기존 결과를 덮어쓰지 않음.
   */
  hydrateFromResultSnapshot: (payload: {
    templateId: string;
    tiers: Tier[];
    pool: TierItem[];
    workspaceTemplateTitle?: string | null;
    workspaceTemplateDescription?: string | null;
    /** 스냅샷에 없으면 null(구 저장본) */
    workspaceBoardSurface?: TemplateBoardSurface | null;
  }) => void;

  setPreviewItem: (item: PicktyItem | null) => void;
  /** 이미지 확대 중 이전(-1)/다음(+1) — 갤러리는 매번 풀+티어에서 재계산 */
  stepImagePreview: (delta: number) => void;

  setWorkspaceBoardSurface: (surface: TemplateBoardSurface | null) => void;

  /** `/template/new` 전용 — 스토어를 도화지 초기 상태로 리셋(템플릿 id 없음) */
  initTemplateBoardEditor: (cfg: TemplateBoardConfig) => void;

  /**
   * `/template/new` 미리보기 풀 — 폼 아이템과 동기화.
   * 폼에 없는 id는 티어·풀에서 제거, 티어에 올라간 카드는 위치 유지, 나머지는 풀에 둠.
   */
  syncTemplatePreviewPoolFromForm: (entries: TierItem[]) => void;
}

export const useTierStore = create<TierState>()(
  persist(
    (set) => ({
      templateId: null,
      workspaceTemplateTitle: null,
      workspaceTemplateDescription: null,
      tiers: INITIAL_TIERS,
      pool: INITIAL_POOL,
      selectedItemIds: [],
      targetTierId: null,
      previewItem: null,

      templateBoardDefaults: null,

      workspaceBoardSurface: null,

      tierAutoSaveIntent: false,
      autoSaveListTitle: null,
      autoSaveListDescription: null,

      beginTierAutoSaveFlow: (meta) =>
        set({
          tierAutoSaveIntent: true,
          autoSaveListTitle: meta?.listTitle?.trim() || null,
          autoSaveListDescription: meta?.listDescription?.trim() || null,
        }),

      clearTierAutoSaveIntent: () => {
        clearTierAutoSaveThumbnailStash();
        set({
          tierAutoSaveIntent: false,
          autoSaveListTitle: null,
          autoSaveListDescription: null,
        });
      },

      setTemplateId: (id) => set({ templateId: id }),

      setPreviewItem: (item) => set({ previewItem: item }),

      stepImagePreview: (delta) =>
        set((state) => {
          const gallery = buildTierImageGallery(state);
          if (gallery.length === 0) return { previewItem: null };
          const id = state.previewItem?.id;
          let idx = id ? gallery.findIndex((i) => i.id === id) : 0;
          if (idx < 0) idx = 0;
          const next = Math.max(0, Math.min(gallery.length - 1, idx + delta));
          return { previewItem: gallery[next]! };
        }),

      setWorkspaceBoardSurface: (surface) => set({ workspaceBoardSurface: surface }),

      initTemplateBoardEditor: (cfg) => {
        clearTierAutoSaveThumbnailStash();
        const cloned = cloneTemplateBoardConfig(cfg);
        const surface =
          cloned.board &&
          (cloned.board.backgroundColor?.trim() || cloned.board.backgroundUrl?.trim())
            ? { ...cloned.board }
            : null;
        set({
          templateId: null,
          workspaceTemplateTitle: null,
          workspaceTemplateDescription: null,
          tiers: emptyTiersFromBoardConfig(cloned),
          templateBoardDefaults: cloned,
          workspaceBoardSurface: surface,
          pool: [],
          selectedItemIds: [],
          targetTierId: null,
          previewItem: null,
          tierAutoSaveIntent: false,
          autoSaveListTitle: null,
          autoSaveListDescription: null,
        });
      },

      syncTemplatePreviewPoolFromForm: (entries) =>
        set((state) => {
          const byId = new Map(entries.map((e) => [e.id, e] as const));
          const allowed = new Set(entries.map((e) => e.id));

          const nextTiers = state.tiers.map((t) => ({
            ...t,
            items: t.items
              .filter((i) => allowed.has(i.id))
              .flatMap((i) => {
                const e = byId.get(i.id);
                if (!e) return [];
                const url = e.imageUrl?.trim();
                if (!url) return [];
                const next: TierItem = { id: e.id, name: e.name, imageUrl: url };
                return [next];
              }),
          }));

          const placed = new Set(nextTiers.flatMap((tier) => tier.items.map((i) => i.id)));
          const nextPool: TierItem[] = [];
          for (const e of entries) {
            const url = e.imageUrl?.trim();
            if (!url) continue;
            if (placed.has(e.id)) continue;
            nextPool.push({ id: e.id, name: e.name, imageUrl: url });
          }

          return { tiers: nextTiers, pool: nextPool };
        }),

      setWorkspaceTemplateMeta: (meta) =>
        set((state) => ({
          workspaceTemplateTitle:
            meta.title !== undefined ? meta.title ?? null : state.workspaceTemplateTitle,
          workspaceTemplateDescription:
            meta.description !== undefined
              ? meta.description ?? null
              : state.workspaceTemplateDescription,
        })),

      loadTemplateWorkspace: ({
        templateId,
        pool,
        workspaceTemplateTitle,
        workspaceTemplateDescription,
        boardConfig,
      }) => {
        const cfg = boardConfig ?? null;
        const tiers =
          cfg != null
            ? emptyTiersFromBoardConfig(cfg)
            : INITIAL_TIERS.map((t) => ({ ...t, items: [] }));
        const surface =
          cfg?.board &&
          (cfg.board.backgroundColor?.trim() || cfg.board.backgroundUrl?.trim())
            ? { ...cfg.board }
            : null;
        set({
          templateId,
          workspaceTemplateTitle: workspaceTemplateTitle ?? null,
          workspaceTemplateDescription: workspaceTemplateDescription ?? null,
          tiers,
          templateBoardDefaults: cfg,
          workspaceBoardSurface: surface,
          pool,
          selectedItemIds: [],
          targetTierId: null,
          previewItem: null,
        });
      },

      hydrateFromResultSnapshot: ({
        templateId,
        tiers,
        pool,
        workspaceTemplateTitle,
        workspaceTemplateDescription,
        workspaceBoardSurface: surfaceFromSnapshot,
      }) => {
        clearTierAutoSaveThumbnailStash();
        const bc = surfaceFromSnapshot?.backgroundColor?.trim();
        const bu = surfaceFromSnapshot?.backgroundUrl?.trim();
        const workspaceBoardSurface =
          bc || bu
            ? {
                ...(bc ? { backgroundColor: bc } : {}),
                ...(bu ? { backgroundUrl: bu } : {}),
              }
            : null;
        set({
          templateId,
          workspaceTemplateTitle: workspaceTemplateTitle ?? null,
          workspaceTemplateDescription: workspaceTemplateDescription ?? null,
          tiers: tiers.map((t) => ({
            ...t,
            items: t.items.map((i) => ({ ...i })),
          })),
          pool: pool.map((i) => ({ ...i })),
          templateBoardDefaults: null,
          workspaceBoardSurface,
          selectedItemIds: [],
          targetTierId: null,
          previewItem: null,
          tierAutoSaveIntent: false,
          autoSaveListTitle: null,
          autoSaveListDescription: null,
        });
      },

      toggleTargetTier: (tierId) =>
        set((state) => ({
          targetTierId: state.targetTierId === tierId ? null : tierId,
          selectedItemIds: [],
        })),

      clearTarget: () => set({ targetTierId: null }),

      toggleItemSelection: (itemId) =>
        set((state) => ({
          selectedItemIds: state.selectedItemIds.includes(itemId)
            ? state.selectedItemIds.filter((id) => id !== itemId)
            : [...state.selectedItemIds, itemId],
        })),

      selectItems: (itemIds) =>
        set((state) => ({
          selectedItemIds: [...new Set([...state.selectedItemIds, ...itemIds])],
        })),

      clearSelection: () => set({ selectedItemIds: [] }),

      moveItems: (itemIds, toTierId) =>
        set((state) => {
          const idsSet = new Set(itemIds);
          const collected: TierItem[] = [];

          const newTiers = state.tiers.map((tier) => ({
            ...tier,
            items: tier.items.filter((item) => {
              if (idsSet.has(item.id)) {
                collected.push(item);
                return false;
              }
              return true;
            }),
          }));

          const newPool = state.pool.filter((item) => {
            if (idsSet.has(item.id)) {
              collected.push(item);
              return false;
            }
            return true;
          });

          if (toTierId === 'pool') {
            return {
              tiers: newTiers,
              pool: [...newPool, ...collected],
              selectedItemIds: state.selectedItemIds.filter((id) => !idsSet.has(id)),
            };
          }

          return {
            tiers: newTiers.map((tier) =>
              tier.id === toTierId
                ? { ...tier, items: [...tier.items, ...collected] }
                : tier,
            ),
            pool: newPool,
            selectedItemIds: state.selectedItemIds.filter((id) => !idsSet.has(id)),
          };
        }),

      reorderTiers: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.tiers.findIndex((t) => t.id === activeId);
          const newIndex = state.tiers.findIndex((t) => t.id === overId);
          if (oldIndex === -1 || newIndex === -1) return {};
          return { tiers: arrayMove(state.tiers, oldIndex, newIndex) };
        }),

      updateTier: (tierId, updates) =>
        set((state) => ({
          tiers: state.tiers.map((tier) =>
            tier.id === tierId ? { ...tier, ...updates } : tier,
          ),
        })),

      addTierRow: (nearTierId, position) =>
        set((state) => {
          if (state.tiers.length >= 20) return {};
          const index = state.tiers.findIndex((t) => t.id === nearTierId);
          if (index === -1) return {};
          const newTier: Tier = {
            id: newTierRowId(),
            label: 'New',
            color: '#A3A3A3',
            textColor: '#111827',
            showLabelColor: false,
            items: [],
          };
          const insertAt = position === 'above' ? index : index + 1;
          const newTiers = [...state.tiers];
          newTiers.splice(insertAt, 0, newTier);
          return { tiers: newTiers };
        }),

      deleteTierRow: (tierId) =>
        set((state) => {
          const tier = state.tiers.find((t) => t.id === tierId);
          if (!tier) return {};
          const returnedIds = new Set(tier.items.map((i) => i.id));
          return {
            tiers: state.tiers.filter((t) => t.id !== tierId),
            pool: [...state.pool, ...tier.items],
            targetTierId: state.targetTierId === tierId ? null : state.targetTierId,
            selectedItemIds: state.selectedItemIds.filter((id) => !returnedIds.has(id)),
          };
        }),

      clearTierRow: (tierId) =>
        set((state) => {
          const tier = state.tiers.find((t) => t.id === tierId);
          if (!tier) return {};
          const returnedIds = new Set(tier.items.map((i) => i.id));
          return {
            tiers: state.tiers.map((t) =>
              t.id === tierId ? { ...t, items: [] } : t,
            ),
            pool: [...state.pool, ...tier.items],
            selectedItemIds: state.selectedItemIds.filter((id) => !returnedIds.has(id)),
          };
        }),

      resetBoard: () => {
        clearTierAutoSaveThumbnailStash();
        set((state) => {
          const fromTiers = state.tiers.flatMap((t) => t.items);
          const seen = new Set<string>();
          const pool: TierItem[] = [];
          for (const item of [...state.pool, ...fromTiers]) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            pool.push(item);
          }
          const defaults = state.templateBoardDefaults;
          const tiers =
            defaults != null
              ? emptyTiersFromBoardConfig(defaults)
              : INITIAL_TIERS.map((t) => ({ ...t, items: [] }));
          const surface =
            defaults?.board &&
            (defaults.board.backgroundColor?.trim() || defaults.board.backgroundUrl?.trim())
              ? { ...defaults.board }
              : null;
          return {
            tiers,
            pool,
            workspaceBoardSurface: surface,
            selectedItemIds: [],
            targetTierId: null,
            previewItem: null,
            tierAutoSaveIntent: false,
            autoSaveListTitle: null,
            autoSaveListDescription: null,
          };
        });
      },
    }),
    {
      name: 'pickty-tier-board',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        templateId: s.templateId,
        tiers: s.tiers,
        pool: s.pool,
        templateBoardDefaults: s.templateBoardDefaults,
        workspaceBoardSurface: s.workspaceBoardSurface,
        tierAutoSaveIntent: s.tierAutoSaveIntent,
        autoSaveListTitle: s.autoSaveListTitle,
        autoSaveListDescription: s.autoSaveListDescription,
      }),
      version: 3,
      migrate: (persisted, fromVersion) => {
        const p = persisted as Record<string, unknown>;
        let next = { ...p };
        if (fromVersion < 2) {
          next = { ...next, templateBoardDefaults: null };
        }
        if (fromVersion < 3) {
          next = { ...next, workspaceBoardSurface: null };
        }
        return next;
      },
    },
  ),
);
