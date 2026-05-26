'use client';

import { useStreamerHostStore } from '@/lib/store/streamer-host-store';

interface Props {
  itemId: number | undefined;
  side: 'A' | 'B';
}

/**
 * 인게임 후보 카드 하단에 임베드되는 슬림 투표율 게이지.
 *
 * - SSE 스냅샷이 없거나(스트리머 모드 아님 = 일반 플레이) 현재 매치에 본 카드 itemId가 없으면 렌더하지 않음
 * - 매 1초 스로틀 푸시에 맞춰 width transition 자연스럽게 갱신
 */
export function StreamerVoteGauge({ itemId, side }: Props) {
  const snapshot = useStreamerHostStore((s) => s.snapshot);
  if (!snapshot?.currentMatch || itemId == null) return null;

  const myKey = String(itemId);
  const { leftId, rightId } = snapshot.currentMatch;
  if (myKey !== leftId && myKey !== rightId) return null;

  const mine = snapshot.matchVotes[myKey] ?? 0;
  const other = snapshot.matchVotes[myKey === leftId ? rightId : leftId] ?? 0;
  const total = mine + other;
  const pct = total > 0 ? Math.round((mine / total) * 1000) / 10 : 0;

  const isLead = mine >= other && total > 0;
  const barClass = side === 'A' ? 'bg-rose-500' : 'bg-sky-500';

  return (
    <div className="pointer-events-none flex w-full shrink-0 items-center gap-2 border-t border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-medium text-zinc-700 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200">
      <span className="tabular-nums" aria-label={`${side === 'A' ? '왼쪽' : '오른쪽'} 시청자 득표 ${mine}표`}>
        {mine}표
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`${barClass} h-full rounded-full transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`tabular-nums ${isLead ? 'font-semibold' : ''}`}>{pct.toFixed(1)}%</span>
    </div>
  );
}
