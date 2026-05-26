import { create } from 'zustand';
import type { StreamerStatus } from '@/lib/streamer/streamer-api';

export type ViewerRole = 'host_vote' | 'personal_play';

interface MatchVoteRecord {
  matchKey: string;
  selectedId: string;
  duplicate: boolean;
  votes: Record<string, number>;
}

interface ViewerState {
  role: ViewerRole | null;
  status: StreamerStatus | null;
  votedByMatch: Record<string, MatchVoteRecord>;
  setRole: (role: ViewerRole) => void;
  setStatus: (status: StreamerStatus) => void;
  recordVote: (record: MatchVoteRecord) => void;
  resetForSession: () => void;
}

export const useStreamerViewerStore = create<ViewerState>((set) => ({
  role: null,
  status: null,
  votedByMatch: {},
  setRole: (role) => set({ role }),
  setStatus: (status) => set({ status }),
  recordVote: (record) =>
    set((state) => ({
      votedByMatch: { ...state.votedByMatch, [record.matchKey]: record },
    })),
  resetForSession: () => set({ role: null, status: null, votedByMatch: {} }),
}));

/** 매치 키 canonical: 좌우 순서 무관하게 같은 키. */
export function matchKeyOf(leftId: string, rightId: string): string {
  return leftId <= rightId ? `${leftId}_${rightId}` : `${rightId}_${leftId}`;
}
