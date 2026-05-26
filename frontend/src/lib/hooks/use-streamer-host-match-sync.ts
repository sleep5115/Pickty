'use client';

import { useEffect, useRef } from 'react';
import { useWorldCupStore } from '@/lib/store/worldcup-store';
import { formatWorldCupRoundLabel } from '@/lib/worldcup/worldcup-bracket-sizes';
import { updateCurrentMatch } from '@/lib/streamer/streamer-api';

interface MatchSyncOptions {
  sessionId: string;
  hostToken: string | null;
  /** PUT /match 실패 시 호출 (호출자에서 host token 무효화 등 처리) */
  onError?: (err: unknown) => void;
}

/**
 * 방장의 인게임 매치업이 바뀔 때마다 PUT /sessions/{id}/match 자동 호출.
 *
 * - 의존: `currentRoundBracket[0].id` / `currentRoundBracket[1].id` — 둘 다 존재할 때만 송출
 * - 직전 페어와 동일하면 skip (selectWinner→다음 매치로 이동할 때 양쪽이 동시에 바뀌는 흐름에서도 1회만 송출)
 * - 라운드 라벨도 같이 보냄 (예: "16강 3경기")
 */
export function useStreamerHostMatchSync({ sessionId, hostToken, onError }: MatchSyncOptions): void {
  const left = useWorldCupStore((s) => s.currentRoundBracket[0]);
  const right = useWorldCupStore((s) => s.currentRoundBracket[1]);
  const roundDisplayPlayerCount = useWorldCupStore((s) => s.roundDisplayPlayerCount);
  const roundPlayingInitialLength = useWorldCupStore((s) => s.roundPlayingInitialLength);
  const currentRoundLen = useWorldCupStore((s) => s.currentRoundBracket.length);

  const lastSentRef = useRef<{ left: string; right: string } | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!hostToken || !sessionId) return;
    if (!left || !right) return;
    const leftId = String(left.id);
    const rightId = String(right.id);
    const prev = lastSentRef.current;
    if (prev && prev.left === leftId && prev.right === rightId) return;

    const matchIndex =
      roundPlayingInitialLength > 0
        ? Math.max(1, (roundPlayingInitialLength - currentRoundLen) / 2 + 1)
        : 1;
    const totalMatches = roundPlayingInitialLength > 0 ? Math.max(1, roundPlayingInitialLength / 2) : 1;
    const roundLabel =
      roundDisplayPlayerCount > 0 ? formatWorldCupRoundLabel(roundDisplayPlayerCount) : '';
    const label = roundLabel ? `${roundLabel} ${matchIndex}/${totalMatches}경기` : null;

    lastSentRef.current = { left: leftId, right: rightId };
    void updateCurrentMatch(sessionId, hostToken, { leftId, rightId, label }).catch((err) => {
      // 송출 실패 시 다음 매치 변경에서 재시도되도록 ref 롤백
      lastSentRef.current = prev;
      onErrorRef.current?.(err);
    });
  }, [sessionId, hostToken, left, right, roundDisplayPlayerCount, roundPlayingInitialLength, currentRoundLen]);
}
