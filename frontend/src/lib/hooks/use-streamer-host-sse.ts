'use client';

import { useEffect, useRef } from 'react';
import { issueSseTicket, sseStreamUrl } from '@/lib/streamer/streamer-api';
import type { HostSnapshot } from '@/lib/store/streamer-host-store';

interface HostSseOptions {
  sessionId: string;
  hostToken: string | null;
  onSnapshot: (snapshot: HostSnapshot) => void;
  onConnectedChange?: (connected: boolean) => void;
  onError?: (err: unknown) => void;
}

interface IncomingHostPayload {
  version: number;
  status: HostSnapshot['status'];
  currentMatch: { leftId: string; rightId: string; label: string | null } | null;
  matchVotes: Record<string, number | string> | null;
  quickVoteItemId: string | null;
  ts: number;
}

/**
 * 방장 SSE 연결 + 단절 시 티켓 재발급 자동 재연결.
 *
 * - 진입 시 POST /ticket → EventSource(...?ticket=...)
 * - onerror 시 즉시 새 티켓 발급 → 새 EventSource 인스턴스 생성
 * - 재시도 폭주 방지: 지수 백오프 (1s → 2s → 4s → max 10s)
 * - unmount 시 EventSource.close + 타이머 정리
 */
export function useStreamerHostSse({
  sessionId,
  hostToken,
  onSnapshot,
  onConnectedChange,
  onError,
}: HostSseOptions): void {
  const onSnapshotRef = useRef(onSnapshot);
  const onConnectedChangeRef = useRef(onConnectedChange);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
    onConnectedChangeRef.current = onConnectedChange;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!sessionId || !hostToken) return;

    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelayMs = 1000;

    function notifyConnected(connected: boolean) {
      onConnectedChangeRef.current?.(connected);
    }

    async function connectOnce() {
      if (cancelled || !hostToken) return;
      try {
        const ticket = await issueSseTicket(sessionId, hostToken);
        if (cancelled) return;
        const es = new EventSource(sseStreamUrl(sessionId, ticket.ticketId));
        source = es;
        es.addEventListener('open', () => {
          retryDelayMs = 1000;
          notifyConnected(true);
        });
        es.addEventListener('hostUpdate', (event) => {
          const msg = event as MessageEvent<string>;
          try {
            const payload = JSON.parse(msg.data) as IncomingHostPayload;
            const matchVotes: Record<string, number> = {};
            for (const [k, v] of Object.entries(payload.matchVotes ?? {})) {
              const n = typeof v === 'number' ? v : Number(v);
              matchVotes[k] = Number.isFinite(n) ? n : 0;
            }
            onSnapshotRef.current({
              version: payload.version,
              status: payload.status,
              currentMatch: payload.currentMatch,
              matchVotes,
              quickVoteItemId: payload.quickVoteItemId,
              ts: payload.ts,
            });
          } catch (e) {
            onErrorRef.current?.(e);
          }
        });
        es.addEventListener('error', () => {
          notifyConnected(false);
          if (cancelled) return;
          es.close();
          source = null;
          retryTimer = setTimeout(connectOnce, retryDelayMs);
          retryDelayMs = Math.min(retryDelayMs * 2, 10_000);
        });
      } catch (err) {
        notifyConnected(false);
        onErrorRef.current?.(err);
        if (cancelled) return;
        retryTimer = setTimeout(connectOnce, retryDelayMs);
        retryDelayMs = Math.min(retryDelayMs * 2, 10_000);
      }
    }

    connectOnce();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (source) {
        source.close();
        source = null;
      }
      notifyConnected(false);
    };
  }, [sessionId, hostToken]);
}
