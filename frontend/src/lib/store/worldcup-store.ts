import { create } from 'zustand';

/** 티어 도메인 `TierItem`과 호환 가능한 최소 필드 */
export interface WorldCupItem {
  id: string;
  name: string;
  imageUrl?: string;
}

/** 플레이 영역 레이아웃 — 백엔드 `layout_mode` 와 동일 개념 */
export type WorldCupLayoutMode = 'split_diagonal' | 'split_lr';

/** 사용자 선택 경로 한 건 — 결과 저장·PNG 대진표 문구용 */
export type WorldCupMatchHistoryEntry =
  | {
      kind: 'selectWinner';
      leftId: string;
      rightId: string;
      leftName: string;
      rightName: string;
      winnerId: string;
      winnerName: string;
      winnerSide: 0 | 1;
    }
  | {
      kind: 'dropBoth';
      leftId: string;
      rightId: string;
      leftName: string;
      rightName: string;
    }
  | {
      kind: 'keepBoth';
      leftId: string;
      rightId: string;
      leftName: string;
      rightName: string;
    }
  | {
      kind: 'reroll';
      side: 0 | 1;
      removedId: string;
      removedName: string;
      newItemId: string;
      newName: string;
    }
  | {
      kind: 'walkover';
      championItemId: string;
      championName: string;
    };

export type WorldCupMatchHistory = WorldCupMatchHistoryEntry[];

function cloneMatchHistory(h: WorldCupMatchHistory): WorldCupMatchHistory {
  return h.map((e) => ({ ...e }));
}

/** 한 아이템별 월드컵 한 판(run) 통계 — 백엔드 페이로드용 */
export interface WorldCupItemStatRow {
  matchCount: number;
  winCount: number;
  rerolledCount: number;
  droppedCount: number;
  keptBothCount: number;
}

export type WorldCupItemStatsMap = Record<string, WorldCupItemStatRow>;

/** 브라우저 탭 유지 동안 누적 — 아이템별 최종 우승 횟수 (우승 비율 분자) */
export type WorldCupChampionshipWinsMap = Record<string, number>;

export function emptyItemStatRow(): WorldCupItemStatRow {
  return {
    matchCount: 0,
    winCount: 0,
    rerolledCount: 0,
    droppedCount: 0,
    keptBothCount: 0,
  };
}

function mergeItemStats(
  stats: WorldCupItemStatsMap,
  itemId: string,
  add: Partial<WorldCupItemStatRow>,
): WorldCupItemStatsMap {
  const prev = stats[itemId] ?? emptyItemStatRow();
  return {
    ...stats,
    [itemId]: {
      matchCount: prev.matchCount + (add.matchCount ?? 0),
      winCount: prev.winCount + (add.winCount ?? 0),
      rerolledCount: prev.rerolledCount + (add.rerolledCount ?? 0),
      droppedCount: prev.droppedCount + (add.droppedCount ?? 0),
      keptBothCount: prev.keptBothCount + (add.keptBothCount ?? 0),
    },
  };
}

function cloneChampionshipWins(m: WorldCupChampionshipWinsMap): WorldCupChampionshipWinsMap {
  return { ...m };
}

function bumpChampionWin(m: WorldCupChampionshipWinsMap, championId: string): WorldCupChampionshipWinsMap {
  return {
    ...m,
    [championId]: (m[championId] ?? 0) + 1,
  };
}

/** matchCount·winCount — 1:1 대결에서 승자 선택 */
function applySelectWinner(
  stats: WorldCupItemStatsMap,
  left: WorldCupItem,
  right: WorldCupItem,
  winnerIndex: 0 | 1,
): WorldCupItemStatsMap {
  let next = mergeItemStats(stats, left.id, { matchCount: 1 });
  next = mergeItemStats(next, right.id, { matchCount: 1 });
  const winner = winnerIndex === 0 ? left : right;
  next = mergeItemStats(next, winner.id, { winCount: 1 });
  return next;
}

function applyDropBoth(stats: WorldCupItemStatsMap, left: WorldCupItem, right: WorldCupItem): WorldCupItemStatsMap {
  let next = mergeItemStats(stats, left.id, { matchCount: 1, droppedCount: 1 });
  next = mergeItemStats(next, right.id, { matchCount: 1, droppedCount: 1 });
  return next;
}

function applyKeepBoth(stats: WorldCupItemStatsMap, left: WorldCupItem, right: WorldCupItem): WorldCupItemStatsMap {
  let next = mergeItemStats(stats, left.id, { matchCount: 1, keptBothCount: 1 });
  next = mergeItemStats(next, right.id, { matchCount: 1, keptBothCount: 1 });
  return next;
}

function applyReroll(stats: WorldCupItemStatsMap, replacedItemId: string): WorldCupItemStatsMap {
  return mergeItemStats(stats, replacedItemId, { rerolledCount: 1 });
}

function cloneItemStats(stats: WorldCupItemStatsMap): WorldCupItemStatsMap {
  const out: WorldCupItemStatsMap = {};
  for (const [id, row] of Object.entries(stats)) {
    out[id] = { ...row };
  }
  return out;
}

/** undo용 — play 필드만 (history 제외) */
export interface WorldCupPlaySnapshot {
  bracketSize: number;
  reservePool: WorldCupItem[];
  currentRoundBracket: WorldCupItem[];
  nextRoundBracket: WorldCupItem[];
  champion: WorldCupItem | null;
  tournamentComplete: boolean;
  reservePoolCount: number;
  layoutMode: WorldCupLayoutMode;
  itemStats: WorldCupItemStatsMap;
  /** 같은 페이지에서 여러 판 플레이 시 누적 우승 횟수 */
  championshipWinsByItemId: WorldCupChampionshipWinsMap;
  /** 이 화면에서 완료한 월드컵 판(게임) 수 */
  completedWorldCupRuns: number;
  /** 현재 판에서의 대진 선택 이력 (undo와 함께 롤백) */
  matchHistory: WorldCupMatchHistory;
}

export interface WorldCupPlayState extends WorldCupPlaySnapshot {
  history: WorldCupPlaySnapshot[];
}

export interface WorldCupPlayActions {
  initialize: (
    allItems: WorldCupItem[],
    bracketSize: number,
    options?: { layoutMode?: WorldCupLayoutMode },
  ) => void;
  rerollItem: (index: 0 | 1) => void;
  selectWinner: (index: 0 | 1) => void;
  dropBoth: () => void;
  keepBoth: () => void;
  undo: () => void;
  reset: () => void;
}

function cloneItem(i: WorldCupItem): WorldCupItem {
  return { ...i };
}

function cloneSnapshot(s: WorldCupPlayState): WorldCupPlaySnapshot {
  return {
    bracketSize: s.bracketSize,
    reservePool: s.reservePool.map(cloneItem),
    currentRoundBracket: s.currentRoundBracket.map(cloneItem),
    nextRoundBracket: s.nextRoundBracket.map(cloneItem),
    champion: s.champion ? cloneItem(s.champion) : null,
    tournamentComplete: s.tournamentComplete,
    reservePoolCount: s.reservePoolCount,
    layoutMode: s.layoutMode,
    itemStats: cloneItemStats(s.itemStats),
    championshipWinsByItemId: cloneChampionshipWins(s.championshipWinsByItemId),
    completedWorldCupRuns: s.completedWorldCupRuns,
    matchHistory: cloneMatchHistory(s.matchHistory),
  };
}

function applySnapshot(snap: WorldCupPlaySnapshot): Omit<WorldCupPlayState, 'history'> {
  return {
    bracketSize: snap.bracketSize,
    reservePool: snap.reservePool.map(cloneItem),
    currentRoundBracket: snap.currentRoundBracket.map(cloneItem),
    nextRoundBracket: snap.nextRoundBracket.map(cloneItem),
    champion: snap.champion ? cloneItem(snap.champion) : null,
    tournamentComplete: snap.tournamentComplete,
    reservePoolCount: snap.reservePoolCount,
    layoutMode: snap.layoutMode,
    itemStats: cloneItemStats(snap.itemStats),
    championshipWinsByItemId: cloneChampionshipWins(snap.championshipWinsByItemId),
    completedWorldCupRuns: snap.completedWorldCupRuns,
    matchHistory: cloneMatchHistory(snap.matchHistory),
  };
}

function pushHistory(
  set: (
    partial:
      | Partial<WorldCupPlayState & WorldCupPlayActions>
      | ((
          state: WorldCupPlayState & WorldCupPlayActions,
        ) => Partial<WorldCupPlayState & WorldCupPlayActions>),
  ) => void,
  get: () => WorldCupPlayState & WorldCupPlayActions,
) {
  const snap = cloneSnapshot(get());
  set((state) => ({
    history: [...state.history, snap],
  }));
}

function randomIndex(n: number): number {
  if (n <= 0) return 0;
  return Math.floor(Math.random() * n);
}

function applyOddRoundBye(pool: WorldCupItem[]): {
  playing: WorldCupItem[];
  bracket: WorldCupItem[];
} {
  if (pool.length <= 1) {
    return { playing: pool, bracket: [] };
  }
  if (pool.length % 2 === 0) {
    return { playing: pool, bracket: [] };
  }
  const next = [...pool];
  const bye = next.splice(randomIndex(next.length), 1)[0]!;
  return { playing: next, bracket: [bye] };
}

function emptyPlayFields(): Omit<WorldCupPlayState, 'history'> {
  return {
    bracketSize: 0,
    reservePool: [],
    currentRoundBracket: [],
    nextRoundBracket: [],
    champion: null,
    tournamentComplete: false,
    reservePoolCount: 0,
    layoutMode: 'split_lr',
    itemStats: {},
    championshipWinsByItemId: {},
    completedWorldCupRuns: 0,
    matchHistory: [],
  };
}

function initialState(): WorldCupPlayState {
  return {
    ...emptyPlayFields(),
    history: [],
  };
}

function transitionToNextRound(
  set: (
    partial:
      | Partial<WorldCupPlayState>
      | ((state: WorldCupPlayState) => Partial<WorldCupPlayState>),
  ) => void,
  get: () => WorldCupPlayState & WorldCupPlayActions,
  incomingPool: WorldCupItem[],
) {
  if (incomingPool.length === 0) {
    set({
      champion: null,
      tournamentComplete: true,
      currentRoundBracket: [],
      nextRoundBracket: [],
      reservePoolCount: get().reservePool.length,
    });
    return;
  }
  if (incomingPool.length === 1) {
    const champ = incomingPool[0]!;
    set((state) => ({
      champion: champ,
      tournamentComplete: true,
      currentRoundBracket: [],
      nextRoundBracket: [],
      reservePoolCount: state.reservePool.length,
      championshipWinsByItemId: bumpChampionWin(state.championshipWinsByItemId, champ.id),
      completedWorldCupRuns: state.completedWorldCupRuns + 1,
    }));
    return;
  }
  const { playing, bracket } = applyOddRoundBye(incomingPool);
  set({
    currentRoundBracket: playing,
    nextRoundBracket: bracket,
    champion: null,
    tournamentComplete: false,
    reservePoolCount: get().reservePool.length,
  });
}

function afterMatchConsumed(
  set: (
    partial:
      | Partial<WorldCupPlayState>
      | ((state: WorldCupPlayState) => Partial<WorldCupPlayState>),
  ) => void,
  get: () => WorldCupPlayState & WorldCupPlayActions,
  rest: WorldCupItem[],
  updatedNext: WorldCupItem[],
) {
  const reserveLen = get().reservePool.length;
  if (rest.length === 0) {
    transitionToNextRound(set, get, updatedNext);
    return;
  }
  if (rest.length === 1) {
    updatedNext.push(rest[0]!);
    transitionToNextRound(set, get, updatedNext);
    return;
  }
  set({
    currentRoundBracket: rest,
    nextRoundBracket: updatedNext,
    reservePoolCount: reserveLen,
  });
}

export const useWorldCupStore = create<WorldCupPlayState & WorldCupPlayActions>((set, get) => ({
  ...initialState(),

  reset: () => set(initialState()),

  undo: () =>
    set((state) => {
      if (state.history.length === 0) return state;
      const snap = state.history[state.history.length - 1]!;
      const restHist = state.history.slice(0, -1);
      return {
        ...applySnapshot(snap),
        history: restHist,
      };
    }),

  initialize: (allItems, bracketSize, options) => {
    const playLayout = options?.layoutMode ?? 'split_lr';
    const cap = Math.max(2, bracketSize);
    const n = Math.min(cap, allItems.length);
    const head = allItems.slice(0, n);
    const reserve = allItems.slice(n);
    const { playing, bracket } = applyOddRoundBye(head);

    if (playing.length === 1 && bracket.length === 0) {
      const only = playing[0]!;
      set((state) => ({
        bracketSize: cap,
        reservePool: reserve,
        reservePoolCount: reserve.length,
        currentRoundBracket: [],
        nextRoundBracket: [],
        champion: only,
        tournamentComplete: true,
        layoutMode: playLayout,
        history: [],
        itemStats: {},
        championshipWinsByItemId: bumpChampionWin(state.championshipWinsByItemId, only.id),
        completedWorldCupRuns: state.completedWorldCupRuns + 1,
        matchHistory: [
          {
            kind: 'walkover',
            championItemId: only.id,
            championName: only.name,
          },
        ],
      }));
      return;
    }

    set({
      bracketSize: cap,
      reservePool: reserve,
      reservePoolCount: reserve.length,
      currentRoundBracket: playing,
      nextRoundBracket: bracket,
      champion: null,
      tournamentComplete: playing.length === 0 && bracket.length <= 1,
      layoutMode: playLayout,
      history: [],
      itemStats: {},
      championshipWinsByItemId: get().championshipWinsByItemId,
      matchHistory: [],
    });
    const st = get();
    if (st.currentRoundBracket.length === 0 && st.nextRoundBracket.length === 1) {
      const c = st.nextRoundBracket[0]!;
      set((state) => ({
        champion: c,
        tournamentComplete: true,
        nextRoundBracket: [],
        reservePoolCount: reserve.length,
        history: [],
        championshipWinsByItemId: bumpChampionWin(state.championshipWinsByItemId, c.id),
        completedWorldCupRuns: state.completedWorldCupRuns + 1,
        matchHistory: [
          {
            kind: 'walkover',
            championItemId: c.id,
            championName: c.name,
          },
        ],
      }));
    }
  },

  rerollItem: (index) => {
    const { reservePool, currentRoundBracket } = get();
    if (reservePool.length === 0 || currentRoundBracket.length < 2) return;
    if (index !== 0 && index !== 1) return;
    if (get().tournamentComplete) return;
    pushHistory(set, get);
    const replaced = currentRoundBracket[index]!;
    const fromPool = reservePool[0]!;
    const next = [...currentRoundBracket];
    next[index] = fromPool;
    set((state) => ({
      currentRoundBracket: next,
      reservePool: reservePool.slice(1),
      reservePoolCount: reservePool.length - 1,
      itemStats: applyReroll(state.itemStats, replaced.id),
      matchHistory: [
        ...state.matchHistory,
        {
          kind: 'reroll',
          side: index,
          removedId: replaced.id,
          removedName: replaced.name,
          newItemId: fromPool.id,
          newName: fromPool.name,
        },
      ],
    }));
  },

  selectWinner: (index) => {
    if (index !== 0 && index !== 1) return;
    const { currentRoundBracket, nextRoundBracket } = get();
    if (currentRoundBracket.length < 2 || get().tournamentComplete) return;
    pushHistory(set, get);
    const left = currentRoundBracket[0]!;
    const right = currentRoundBracket[1]!;
    const rest = currentRoundBracket.slice(2);
    const winner = index === 0 ? left : right;
    const updatedNext = [...nextRoundBracket, winner];
    set((state) => ({
      itemStats: applySelectWinner(state.itemStats, left, right, index),
      matchHistory: [
        ...state.matchHistory,
        {
          kind: 'selectWinner',
          leftId: left.id,
          rightId: right.id,
          leftName: left.name,
          rightName: right.name,
          winnerId: winner.id,
          winnerName: winner.name,
          winnerSide: index,
        },
      ],
    }));
    afterMatchConsumed(set, get, rest, updatedNext);
  },

  dropBoth: () => {
    const { currentRoundBracket, nextRoundBracket } = get();
    if (currentRoundBracket.length < 2 || get().tournamentComplete) return;
    pushHistory(set, get);
    const left = currentRoundBracket[0]!;
    const right = currentRoundBracket[1]!;
    const rest = currentRoundBracket.slice(2);
    const updatedNext = [...nextRoundBracket];
    set((state) => ({
      itemStats: applyDropBoth(state.itemStats, left, right),
      matchHistory: [
        ...state.matchHistory,
        {
          kind: 'dropBoth',
          leftId: left.id,
          rightId: right.id,
          leftName: left.name,
          rightName: right.name,
        },
      ],
    }));
    afterMatchConsumed(set, get, rest, updatedNext);
  },

  keepBoth: () => {
    const { currentRoundBracket, nextRoundBracket } = get();
    if (currentRoundBracket.length < 2 || get().tournamentComplete) return;
    pushHistory(set, get);
    const left = currentRoundBracket[0]!;
    const right = currentRoundBracket[1]!;
    const rest = currentRoundBracket.slice(2);
    const updatedNext = [...nextRoundBracket, left, right];
    set((state) => ({
      itemStats: applyKeepBoth(state.itemStats, left, right),
      matchHistory: [
        ...state.matchHistory,
        {
          kind: 'keepBoth',
          leftId: left.id,
          rightId: right.id,
          leftName: left.name,
          rightName: right.name,
        },
      ],
    }));
    afterMatchConsumed(set, get, rest, updatedNext);
  },
}));
