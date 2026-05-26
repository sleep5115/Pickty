'use client';

import { useEffect, useRef } from 'react';
import { useWorldCupStore } from '@/lib/store/worldcup-store';
import { finishStreamerSession } from '@/lib/streamer/streamer-api';
import { clearHostToken } from '@/lib/streamer/host-token-storage';

interface AutoFinishOptions {
  sessionId: string;
  hostToken: string | null;
  onFinished?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * 토너먼트가 끝나 champion이 확정되는 첫 순간에 단 1회 POST /finish.
 *
 * - 결과 페이지로 자동 전이되는 흐름에 영향 없이 백그라운드 호출
 * - 락 ref로 다시 시작/재마운트에서도 중복 호출 차단
 * - 성공 후 localStorage hostToken 폐기 → 잔여 페이지 진입 시 fallback 토큰 흐름으로 안전 처리
 */
export function useStreamerHostAutoFinish({ sessionId, hostToken, onFinished, onError }: AutoFinishOptions): void {
  const tournamentComplete = useWorldCupStore((s) => s.tournamentComplete);
  const champion = useWorldCupStore((s) => s.champion);

  const firedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onFinishedRef.current = onFinished;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (firedRef.current) return;
    if (!sessionId || !hostToken) return;
    if (!tournamentComplete || !champion) return;

    firedRef.current = true;
    void finishStreamerSession(sessionId, hostToken)
      .then(() => {
        clearHostToken(sessionId);
        onFinishedRef.current?.();
      })
      .catch((err) => {
        // 실패해도 다시 발사하지 않음 — 다음 idle sweeper가 영속화한다.
        onErrorRef.current?.(err);
      });
  }, [sessionId, hostToken, tournamentComplete, champion]);
}
