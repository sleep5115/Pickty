import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import { clearTierAutoSaveThumbnailStash } from '@/lib/tier-autosave-thumbnail';

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
  color: string;
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
  { id: 'S', label: 'S', color: '#FF7F7F', items: [] },
  { id: 'A', label: 'A', color: '#FFBF7F', items: [] },
  { id: 'B', label: 'B', color: '#FFDF7F', items: [] },
  { id: 'C', label: 'C', color: '#BFFF7F', items: [] },
  { id: 'D', label: 'D', color: '#7FFF7F', items: [] },
  { id: 'E', label: 'E', color: '#7FFFFF', items: [] },
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
    updates: { label?: string; color?: string; backgroundUrl?: string | undefined },
  ) => void;

  /** 선택한 행의 위 또는 아래에 빈 티어 행 추가 */
  addTierRow: (nearTierId: string, position: 'above' | 'below') => void;

  /** 행 삭제 — 해당 행 아이템은 Pool로 반환 */
  deleteTierRow: (tierId: string) => void;

  /** 행 비우기 — 행은 유지하고 아이템만 Pool로 반환 */
  clearTierRow: (tierId: string) => void;

  resetBoard: () => void;
  setTemplateId: (id: string | null) => void;

  /** 서버 템플릿으로 풀만 교체 — 티어 행은 기본 S~E 빈 상태 */
  loadTemplateWorkspace: (payload: {
    templateId: string;
    pool: TierItem[];
    workspaceTemplateTitle?: string | null;
    workspaceTemplateDescription?: string | null;
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
  }) => void;

  setPreviewItem: (item: PicktyItem | null) => void;
  /** 이미지 확대 중 이전(-1)/다음(+1) — 갤러리는 매번 풀+티어에서 재계산 */
  stepImagePreview: (delta: number) => void;
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
      }) =>
        set({
          templateId,
          workspaceTemplateTitle: workspaceTemplateTitle ?? null,
          workspaceTemplateDescription: workspaceTemplateDescription ?? null,
          tiers: INITIAL_TIERS.map((t) => ({ ...t, items: [] })),
          pool,
          selectedItemIds: [],
          targetTierId: null,
          previewItem: null,
        }),

      hydrateFromResultSnapshot: ({
        templateId,
        tiers,
        pool,
        workspaceTemplateTitle,
        workspaceTemplateDescription,
      }) => {
        clearTierAutoSaveThumbnailStash();
        set({
          templateId,
          workspaceTemplateTitle: workspaceTemplateTitle ?? null,
          workspaceTemplateDescription: workspaceTemplateDescription ?? null,
          tiers: tiers.map((t) => ({
            ...t,
            items: t.items.map((i) => ({ ...i })),
          })),
          pool: pool.map((i) => ({ ...i })),
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
          const index = state.tiers.findIndex((t) => t.id === nearTierId);
          if (index === -1) return {};
          const newTier: Tier = {
            id: newTierRowId(),
            label: 'New',
            color: '#A3A3A3',
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
          return {
            tiers: INITIAL_TIERS.map((t) => ({ ...t, items: [] })),
            pool,
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
        tierAutoSaveIntent: s.tierAutoSaveIntent,
        autoSaveListTitle: s.autoSaveListTitle,
        autoSaveListDescription: s.autoSaveListDescription,
      }),
      version: 1,
    },
  ),
);
