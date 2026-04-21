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

/**
 * 현재 판의 `matchHistory`만으로 `itemStats` 누적치를 재계산한다.
 * - `POST /api/v1/worldcup/results` 제출 시 **이 값을 쓰면** 스토어 `itemStats`와 어긋나도 이력 정본으로 서버와 맞출 수 있다.
 * - `walkover` 는 1:1 대결이 아니므로 여기서는 반영하지 않는다.
 */
export function aggregateItemStatsFromMatchHistory(history: WorldCupMatchHistory): WorldCupItemStatsMap {
  let stats: WorldCupItemStatsMap = {};
  for (const e of history) {
    if (e.kind === 'selectWinner') {
      stats = mergeItemStats(stats, e.leftId, { matchCount: 1 });
      stats = mergeItemStats(stats, e.rightId, { matchCount: 1 });
      stats = mergeItemStats(stats, e.winnerId, { winCount: 1 });
    } else if (e.kind === 'dropBoth') {
      stats = mergeItemStats(stats, e.leftId, { matchCount: 1, droppedCount: 1 });
      stats = mergeItemStats(stats, e.rightId, { matchCount: 1, droppedCount: 1 });
    } else if (e.kind === 'keepBoth') {
      stats = mergeItemStats(stats, e.leftId, { matchCount: 1, keptBothCount: 1 });
      stats = mergeItemStats(stats, e.rightId, { matchCount: 1, keptBothCount: 1 });
    } else if (e.kind === 'reroll') {
      stats = mergeItemStats(stats, e.removedId, { rerolledCount: 1 });
    }
  }
  return stats;
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
  /** 강수 선택 후 실제 플레이 중일 때만 true */
  isPlaying: boolean;
  /** 현재 라운드 시작 시 `currentRoundBracket` 길이(대기열 기준, 매치 수 계산용) */
  roundPlayingInitialLength: number;
  /** 라운드 헤더 라벨용 — 라운드 진입 시점의 참가자 수(결승전은 2) */
  roundDisplayPlayerCount: number;
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
  /** 결과 화면에서 다시 하기 → 강수 선택으로 (누적 우승·완료 판 수는 유지) */
  leaveToBracketSelection: () => void;
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
    isPlaying: s.isPlaying,
    roundPlayingInitialLength: s.roundPlayingInitialLength,
    roundDisplayPlayerCount: s.roundDisplayPlayerCount,
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
    isPlaying: snap.isPlaying,
    roundPlayingInitialLength: snap.roundPlayingInitialLength,
    roundDisplayPlayerCount: snap.roundDisplayPlayerCount,
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

function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
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
    isPlaying: false,
    roundPlayingInitialLength: 0,
    roundDisplayPlayerCount: 0,
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
  const shuffled = shuffleArray(incomingPool);
  const displayCount = shuffled.length;

  if (shuffled.length === 0) {
    set({
      champion: null,
      tournamentComplete: true,
      currentRoundBracket: [],
      nextRoundBracket: [],
      reservePoolCount: get().reservePool.length,
      roundPlayingInitialLength: 0,
      roundDisplayPlayerCount: 0,
    });
    return;
  }
  if (shuffled.length === 1) {
    const champ = shuffled[0]!;
    set((state) => ({
      champion: champ,
      tournamentComplete: true,
      currentRoundBracket: [],
      nextRoundBracket: [],
      reservePoolCount: state.reservePool.length,
      championshipWinsByItemId: bumpChampionWin(state.championshipWinsByItemId, champ.id),
      completedWorldCupRuns: state.completedWorldCupRuns + 1,
      roundPlayingInitialLength: 0,
      roundDisplayPlayerCount: 0,
    }));
    return;
  }
  const { playing, bracket } = applyOddRoundBye(shuffled);
  set({
    currentRoundBracket: playing,
    nextRoundBracket: bracket,
    champion: null,
    tournamentComplete: false,
    reservePoolCount: get().reservePool.length,
    isPlaying: true,
    roundDisplayPlayerCount: displayCount,
    roundPlayingInitialLength: playing.length,
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

  leaveToBracketSelection: () =>
    set((state) => ({
      ...emptyPlayFields(),
      history: [],
      championshipWinsByItemId: state.championshipWinsByItemId,
      completedWorldCupRuns: state.completedWorldCupRuns,
    })),

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
    const shuffled = shuffleArray(allItems);
    /** N강 = N명 출전. 선택한 강 수만큼만 대진에 넣고 나머지는 reserve(리롤 풀). */
    const n = Math.min(cap, shuffled.length);
    const head = shuffled.slice(0, n);
    const reserve = shuffled.slice(n);
    const { playing, bracket } = applyOddRoundBye(head);
    const displayCount = n;

    if (playing.length === 1 && bracket.length === 0) {
      const only = playing[0]!;
      set((state) => ({
        bracketSize: cap,
        isPlaying: true,
        roundPlayingInitialLength: 0,
        roundDisplayPlayerCount: 0,
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
      isPlaying: true,
      roundDisplayPlayerCount: displayCount,
      roundPlayingInitialLength: playing.length,
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
        isPlaying: true,
        roundPlayingInitialLength: 0,
        roundDisplayPlayerCount: 0,
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

  /** 교체된 쪽 후보: `rerolledCount+1` (리롤당함). 새로 들어온 풀 아이템은 여기서 카운트하지 않는다. */
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

  /**
   * 좌(0)·우(1) 중 승자 선택.
   * 통계: 양쪽 `matchCount+1`, 승자만 `winCount+1`.
   */
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

  /** 광탈: 양쪽 `matchCount+1`, `droppedCount+1`. */
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

  /** 둘 다 올리기: 양쪽 `matchCount+1`, `keptBothCount+1`. */
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
