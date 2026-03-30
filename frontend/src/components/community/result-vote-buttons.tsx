'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toggleReaction, type CommunityReactionType } from '@/lib/api/community-api';
import { useReactionsInteractiveSurface } from '@/lib/hooks/use-reactions-interactive-surface';
import { useAuthStore } from '@/lib/store/auth-store';
import { getStoredReaction, setStoredReaction } from '@/lib/store/reaction-store';

export type VoteSelection = 'UPVOTE' | 'DOWNVOTE' | null;

type Props = {
  resultId: string;
  initialUpCount: number;
  initialDownCount: number;
  initialMyReaction?: CommunityReactionType | null;
  onMyReactionResolved?: (reaction: CommunityReactionType | null) => void;
  className?: string;
  onCountsChange?: (up: number, down: number) => void;
  /** 기본 `sm` — 카드 등. `lg`는 결과 상세 등 강조 UI */
  size?: 'sm' | 'lg';
};

function predictToggle(
  selection: VoteSelection,
  click: CommunityReactionType,
): { nextSel: VoteSelection; dUp: number; dDown: number } {
  if (click === 'UPVOTE') {
    if (selection === 'UPVOTE') return { nextSel: null, dUp: -1, dDown: 0 };
    if (selection === 'DOWNVOTE') return { nextSel: 'UPVOTE', dUp: 1, dDown: -1 };
    return { nextSel: 'UPVOTE', dUp: 1, dDown: 0 };
  }
  if (selection === 'DOWNVOTE') return { nextSel: null, dUp: 0, dDown: -1 };
  if (selection === 'UPVOTE') return { nextSel: 'DOWNVOTE', dUp: -1, dDown: 1 };
  return { nextSel: 'DOWNVOTE', dUp: 0, dDown: 1 };
}

function selectionFromServer(
  active: boolean,
  reactionType: CommunityReactionType | null,
): VoteSelection {
  if (!active || !reactionType) return null;
  if (reactionType === 'UPVOTE') return 'UPVOTE';
  if (reactionType === 'DOWNVOTE') return 'DOWNVOTE';
  return null;
}

/** 토글 직전 스냅샷과 서버가 알려준 최종 선택으로 카운트를 맞춤 (API가 집계를 안 줄 때) */
function countsForServerSelection(
  prevSel: VoteSelection,
  prevUp: number,
  prevDown: number,
  serverSel: VoteSelection,
): { up: number; down: number } {
  const dUp =
    (serverSel === 'UPVOTE' ? 1 : 0) - (prevSel === 'UPVOTE' ? 1 : 0);
  const dDown =
    (serverSel === 'DOWNVOTE' ? 1 : 0) - (prevSel === 'DOWNVOTE' ? 1 : 0);
  return {
    up: Math.max(0, prevUp + dUp),
    down: Math.max(0, prevDown + dDown),
  };
}

export function ResultVoteButtons({
  resultId,
  initialUpCount,
  initialDownCount,
  initialMyReaction = null,
  onMyReactionResolved,
  className = '',
  onCountsChange,
  size = 'sm',
}: Props) {
  const surfaceInteractive = useReactionsInteractiveSurface();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isMember = Boolean(accessToken);

  const [selection, setSelection] = useState<VoteSelection>(null);
  const [upCount, setUpCount] = useState(initialUpCount);
  const [downCount, setDownCount] = useState(initialDownCount);
  const [busy, setBusy] = useState<'UP' | 'DOWN' | null>(null);

  useEffect(() => {
    setUpCount(initialUpCount);
    setDownCount(initialDownCount);
  }, [initialUpCount, initialDownCount, resultId]);

  useEffect(() => {
    if (!resultId) return;
    if (isMember) {
      const sel: VoteSelection =
        initialMyReaction === 'UPVOTE'
          ? 'UPVOTE'
          : initialMyReaction === 'DOWNVOTE'
            ? 'DOWNVOTE'
            : null;
      setSelection(sel);
      return;
    }
    const stored = getStoredReaction(resultId);
    setSelection(selectionFromServer(stored === 'UPVOTE' || stored === 'DOWNVOTE', stored));
  }, [isMember, initialMyReaction, resultId]);

  const applyCounts = useCallback(
    (up: number, down: number) => {
      const u = Math.max(0, up);
      const d = Math.max(0, down);
      setUpCount(u);
      setDownCount(d);
      onCountsChange?.(u, d);
    },
    [onCountsChange],
  );

  const handleVote = useCallback(
    async (click: CommunityReactionType, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (!surfaceInteractive || !resultId || busy) return;
      const prevSel = selection;
      const prevUp = upCount;
      const prevDown = downCount;
      const { nextSel, dUp, dDown } = predictToggle(selection, click);
      setSelection(nextSel);
      applyCounts(prevUp + dUp, prevDown + dDown);
      setBusy(click === 'UPVOTE' ? 'UP' : 'DOWN');
      try {
        const r = await toggleReaction('TIER_RESULT', resultId, click);
        const serverSel = selectionFromServer(r.active, r.reactionType);
        setSelection(serverSel);
        const { up, down } = countsForServerSelection(prevSel, prevUp, prevDown, serverSel);
        applyCounts(up, down);
        if (!isMember) {
          if (serverSel === 'UPVOTE') setStoredReaction(resultId, 'UPVOTE');
          else if (serverSel === 'DOWNVOTE') setStoredReaction(resultId, 'DOWNVOTE');
          else setStoredReaction(resultId, null);
        } else {
          setStoredReaction(resultId, null);
        }
        if (isMember) {
          onMyReactionResolved?.(
            serverSel === 'UPVOTE'
              ? 'UPVOTE'
              : serverSel === 'DOWNVOTE'
                ? 'DOWNVOTE'
                : null,
          );
        }
      } catch (err) {
        setSelection(prevSel);
        applyCounts(prevUp, prevDown);
        toast.error(err instanceof Error ? err.message : '투표 처리에 실패했습니다.');
      } finally {
        setBusy(null);
      }
    },
    [
      surfaceInteractive,
      resultId,
      busy,
      selection,
      upCount,
      downCount,
      applyCounts,
      isMember,
      onMyReactionResolved,
    ],
  );

  const locked = !surfaceInteractive;
  const isLg = size === 'lg';
  const rowGap = isLg ? 'gap-5' : 'gap-3';
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-zinc-500/40 dark:focus-visible:ring-offset-zinc-900';
  /** 카드·목록 — 테두리 없음 */
  const btnSmBase = `inline-flex items-center gap-1 border-0 bg-transparent px-0 py-0.5 text-xs font-medium tabular-nums rounded-sm ${focusRing}`;
  /** 결과 상세 — 라운드·테두리 박스 (색은 항상 빨강/파랑, 선택 시 테두리 글로우) */
  const btnLgBase = `inline-flex items-center gap-2 rounded-xl border-2 px-5 py-3 text-base font-semibold tabular-nums transition-shadow duration-200 ${focusRing}`;
  /** 상세·추천 — 비선택은 옅은 빨강 테두리, 선택 시 진한 테두리 + 붉은 글로우 */
  const lgUpIdle =
    'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/35 dark:text-red-200';
  const lgUpLit =
    'border-red-500 bg-red-50 text-red-800 shadow-[0_0_0_1px_rgb(239,68,68),0_0_16px_5px_rgba(239,68,68,0.45)] dark:border-red-400 dark:bg-red-950/45 dark:text-red-100 dark:shadow-[0_0_0_1px_rgb(248,113,113),0_0_18px_6px_rgba(248,113,113,0.4)]';
  /** 상세·비추천 */
  const lgDownIdle =
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-200';
  const lgDownLit =
    'border-blue-500 bg-blue-50 text-blue-800 shadow-[0_0_0_1px_rgb(59,130,246),0_0_16px_5px_rgba(59,130,246,0.45)] dark:border-blue-400 dark:bg-blue-950/45 dark:text-blue-100 dark:shadow-[0_0_0_1px_rgb(96,165,250),0_0_18px_6px_rgba(96,165,250,0.4)]';
  const iconUp = isLg ? 'h-7 w-7' : 'h-3.5 w-3.5';
  const iconStroke = isLg ? 2.25 : 2;

  const canInteract = !locked && busy === null && resultId;

  return (
    <div
      className={['inline-flex flex-wrap items-center justify-center', rowGap, className].join(' ')}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="추천·비추천"
      title={locked ? '티어 만들기·결과 화면에서만 추천할 수 있어요' : undefined}
    >
      <button
        type="button"
        disabled={busy !== null || !resultId}
        aria-disabled={locked || busy !== null || !resultId}
        tabIndex={locked ? -1 : 0}
        aria-pressed={selection === 'UPVOTE'}
        onClick={(e) => void handleVote('UPVOTE', e)}
        className={[
          isLg ? btnLgBase : btnSmBase,
          'transition-colors disabled:cursor-default',
          isLg
            ? selection === 'UPVOTE'
              ? lgUpLit
              : lgUpIdle
            : 'text-red-600 dark:text-red-400',
          canInteract
            ? isLg
              ? selection === 'UPVOTE'
                ? 'cursor-pointer hover:opacity-95'
                : 'cursor-pointer hover:border-red-300 hover:bg-red-100/90 dark:hover:border-red-600 dark:hover:bg-red-950/50'
              : 'cursor-pointer hover:opacity-90'
            : '',
          busy === 'UP' ? 'opacity-60' : '',
        ].join(' ')}
      >
        <ThumbsUp
          className={[iconUp, 'shrink-0'].join(' ')}
          strokeWidth={iconStroke}
          stroke="currentColor"
          aria-hidden
        />
        <span className="min-w-[1.25em] text-center">{upCount}</span>
      </button>
      <button
        type="button"
        disabled={busy !== null || !resultId}
        aria-disabled={locked || busy !== null || !resultId}
        tabIndex={locked ? -1 : 0}
        aria-pressed={selection === 'DOWNVOTE'}
        onClick={(e) => void handleVote('DOWNVOTE', e)}
        className={[
          isLg ? btnLgBase : btnSmBase,
          'transition-colors disabled:cursor-default',
          isLg
            ? selection === 'DOWNVOTE'
              ? lgDownLit
              : lgDownIdle
            : 'text-[#2563eb] dark:text-[#60a5fa]',
          canInteract
            ? isLg
              ? selection === 'DOWNVOTE'
                ? 'cursor-pointer hover:opacity-95'
                : 'cursor-pointer hover:border-blue-300 hover:bg-blue-100/90 dark:hover:border-blue-600 dark:hover:bg-blue-950/50'
              : 'cursor-pointer hover:opacity-90'
            : '',
          busy === 'DOWN' ? 'opacity-60' : '',
        ].join(' ')}
      >
        {isLg ? (
          <>
            <ThumbsDown
              className={[iconUp, 'shrink-0'].join(' ')}
              strokeWidth={iconStroke}
              stroke="currentColor"
              aria-hidden
            />
            <span className="min-w-[1.25em] text-center tabular-nums">{downCount}</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            <ThumbsDown
              className={[iconUp, 'shrink-0'].join(' ')}
              strokeWidth={iconStroke}
              stroke="currentColor"
              aria-hidden
            />
            <span className="min-w-[1.25em] text-center tabular-nums">{downCount}</span>
          </span>
        )}
      </button>
    </div>
  );
}
