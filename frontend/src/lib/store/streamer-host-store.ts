import { create } from 'zustand';

export interface HostMatchVotes {
  /** itemId → votes */
  [itemId: string]: number;
}

export interface HostSnapshot {
  version: number;
  status: 'READY' | 'PLAYING' | 'FINISHED' | 'EXPIRED_FINISHED';
  currentMatch: { leftId: string; rightId: string; label: string | null } | null;
  matchVotes: HostMatchVotes;
  quickVoteItemId: string | null;
  ts: number;
}

interface HostState {
  snapshot: HostSnapshot | null;
  sseConnected: boolean;
  setSnapshot: (snapshot: HostSnapshot) => void;
  setSseConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useStreamerHostStore = create<HostState>((set) => ({
  snapshot: null,
  sseConnected: false,
  setSnapshot: (snapshot) => set({ snapshot }),
  setSseConnected: (sseConnected) => set({ sseConnected }),
  reset: () => set({ snapshot: null, sseConnected: false }),
}));
