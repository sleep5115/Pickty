import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';

export interface TierItem {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface Tier {
  id: string;
  label: string;
  color: string;
  items: TierItem[];
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

const INITIAL_POOL: TierItem[] = [
  { id: 'item-1', name: '곤 프릭스' },
  { id: 'item-2', name: '킬루아' },
  { id: 'item-3', name: '쿠라피카' },
  { id: 'item-4', name: '레오리오' },
  { id: 'item-5', name: '히소카' },
  { id: 'item-6', name: '네테로' },
  { id: 'item-7', name: '비스켓' },
  { id: 'item-8', name: '메루엠' },
  { id: 'item-9', name: '코무기' },
  { id: 'item-10', name: '일루미' },
  { id: 'item-11', name: '치로루' },
  { id: 'item-12', name: '제노' },
  { id: 'item-13', name: '실바' },
  { id: 'item-14', name: '나니카' },
  { id: 'item-15', name: '모라우' },
  { id: 'item-16', name: '크노브' },
  { id: 'item-17', name: '팜' },
  { id: 'item-18', name: '이카루고' },
  { id: 'item-19', name: '샤르나크' },
  { id: 'item-20', name: '핑크' },
  { id: 'item-21', name: '고레이누' },
  { id: 'item-22', name: '카이토' },
  { id: 'item-23', name: '나크' },
  { id: 'item-24', name: '치아들' },
];

interface TierState {
  /** 서버 템플릿 UUID — 없으면 첫 서버 저장 시 템플릿 생성 */
  templateId: string | null;
  tiers: Tier[];
  pool: TierItem[];
  selectedItemIds: string[];
  targetTierId: string | null;

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

  /** 특정 티어의 label / color 변경 */
  updateTier: (tierId: string, updates: { label?: string; color?: string }) => void;

  /** 선택한 행의 위 또는 아래에 빈 티어 행 추가 */
  addTierRow: (nearTierId: string, position: 'above' | 'below') => void;

  /** 행 삭제 — 해당 행 아이템은 Pool로 반환 */
  deleteTierRow: (tierId: string) => void;

  /** 행 비우기 — 행은 유지하고 아이템만 Pool로 반환 */
  clearTierRow: (tierId: string) => void;

  resetBoard: () => void;
  setTemplateId: (id: string | null) => void;

  /** 서버 템플릿으로 풀만 교체 — 티어 행은 기본 S~E 빈 상태 */
  loadTemplateWorkspace: (payload: { templateId: string; pool: TierItem[] }) => void;
}

export const useTierStore = create<TierState>()((set) => ({
  templateId: null,
  tiers: INITIAL_TIERS,
  pool: INITIAL_POOL,
  selectedItemIds: [],
  targetTierId: null,

  setTemplateId: (id) => set({ templateId: id }),

  loadTemplateWorkspace: ({ templateId, pool }) =>
    set({
      templateId,
      tiers: INITIAL_TIERS.map((t) => ({ ...t, items: [] })),
      pool,
      selectedItemIds: [],
      targetTierId: null,
    }),

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

  resetBoard: () =>
    set({
      templateId: null,
      tiers: INITIAL_TIERS.map((t) => ({ ...t, items: [] })),
      pool: [...INITIAL_POOL],
      selectedItemIds: [],
      targetTierId: null,
    }),
}));
