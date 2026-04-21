'use client';

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  toggleReaction,
  type InteractionTargetType,
  type ReactionType,
} from '@/lib/api/interaction-api';
import { useReactionsInteractiveSurface } from '@/lib/hooks/use-reactions-interactive-surface';
import { useAuthStore } from '@/lib/store/auth-store';
import { getStoredReaction, setStoredReaction } from '@/lib/store/reaction-store';

type Props = {
  /** `plain` — 목록 카드(테두리 없음). `boxed`(기본) — 티어 화면 헤더 등 */
  appearance?: 'plain' | 'boxed';
  /** 기본 티어 템플릿 — 월드컵 목록·플레이는 `WORLDCUP_TEMPLATE` */
  interactionTargetType?: InteractionTargetType;
  templateId: string;
  initialLikeCount: number;
  /** 로그인 시 API `myReaction` — 비회원이면 무시하고 localStorage 사용 */
  initialMyReaction?: ReactionType | null;
  /** 토글 성공 후 부모가 `myReaction` 등을 동기화할 때 */
  onMyReactionResolved?: (reaction: ReactionType | null) => void;
  className?: string;
  onLikeCountChange?: (next: number) => void;
};

export function TemplateLikeButton({
  appearance = 'boxed',
  interactionTargetType = 'TIER_TEMPLATE',
  templateId,
  initialLikeCount,
  initialMyReaction = null,
  onMyReactionResolved,
  className = '',
  onLikeCountChange,
}: Props) {
  const surfaceInteractive = useReactionsInteractiveSurface();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isMember = Boolean(accessToken);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLikeCount(initialLikeCount);
  }, [initialLikeCount]);

  useEffect(() => {
    if (!templateId) return;
    if (isMember) {
      setLiked(initialMyReaction === 'LIKE');
      return;
    }
    setLiked(getStoredReaction(templateId) === 'LIKE');
  }, [isMember, initialMyReaction, templateId]);

  const applyCount = useCallback(
    (next: number) => {
      setLikeCount(next);
      onLikeCountChange?.(next);
    },
    [onLikeCountChange],
  );

  const onClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!surfaceInteractive || !templateId || busy) return;
      const prevLiked = liked;
      const prevCount = likeCount;
      const nextLiked = !prevLiked;
      const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
      setLiked(nextLiked);
      applyCount(nextCount);
      setBusy(true);
      try {
        const r = await toggleReaction(interactionTargetType, templateId, 'LIKE');
        const serverLiked = Boolean(r.active && r.reactionType === 'LIKE');
        setLiked(serverLiked);
        const syncedCount = Math.max(
          0,
          prevCount - (prevLiked ? 1 : 0) + (serverLiked ? 1 : 0),
        );
        applyCount(syncedCount);
        if (!isMember) {
          if (serverLiked && r.reactionType === 'LIKE') {
            setStoredReaction(templateId, 'LIKE');
          } else {
            setStoredReaction(templateId, null);
          }
        } else {
          setStoredReaction(templateId, null);
        }
        if (isMember) {
          onMyReactionResolved?.(
            serverLiked && r.reactionType === 'LIKE' ? 'LIKE' : null,
          );
        }
      } catch (err) {
        setLiked(prevLiked);
        applyCount(prevCount);
        toast.error(err instanceof Error ? err.message : '좋아요 처리에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [
      surfaceInteractive,
      interactionTargetType,
      templateId,
      busy,
      liked,
      likeCount,
      applyCount,
      isMember,
      onMyReactionResolved,
    ],
  );

  const locked = !surfaceInteractive;
  const isPlain = appearance === 'plain';
  const canInteract = !locked && !busy && templateId;

  /** 박스형 — 비선택은 옅은 핑크 테두리·배경, 선택 시 진한 테두리 + 핑크 글로우 (추천/비추천 lg와 동일 패턴) */
  const boxedIdle =
    'border-pink-200 bg-pink-50 text-pink-800 dark:border-pink-800 dark:bg-pink-950/35 dark:text-pink-200';
  const boxedLit =
    'border-pink-500 bg-pink-50 text-pink-800 shadow-[0_0_0_1px_rgb(236,72,153),0_0_16px_5px_rgba(236,72,153,0.45)] dark:border-pink-400 dark:bg-pink-950/45 dark:text-pink-100 dark:shadow-[0_0_0_1px_rgb(244,114,182),0_0_18px_6px_rgba(244,114,182,0.4)]';

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy || !templateId}
      aria-disabled={locked || busy || !templateId}
      tabIndex={locked ? -1 : 0}
      aria-pressed={liked}
      title={locked ? '플레이 화면에서만 좋아요할 수 있어요' : undefined}
      className={[
        'inline-flex items-center gap-1.5 text-xs font-medium tabular-nums transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900',
        !isPlain ? 'transition-shadow duration-200' : '',
        isPlain
          ? [
              'border-0 bg-transparent px-0 py-0.5 rounded-sm',
              'text-pink-600 dark:text-pink-400',
              canInteract
                ? liked
                  ? 'cursor-pointer hover:opacity-95'
                  : 'cursor-pointer hover:text-pink-700 dark:hover:text-pink-300'
                : '',
            ].join(' ')
          : [
              'rounded-lg border px-2.5 py-1.5',
              liked ? boxedLit : boxedIdle,
              canInteract
                ? liked
                  ? 'cursor-pointer hover:opacity-95'
                  : 'cursor-pointer hover:border-pink-300 hover:bg-pink-100/90 dark:hover:border-pink-600 dark:hover:bg-pink-950/50'
                : '',
            ].join(' '),
        busy ? 'opacity-60' : '',
        className,
      ].join(' ')}
    >
      <Heart
        className={`h-3.5 w-3.5 shrink-0 ${liked ? 'fill-current' : ''}`}
        strokeWidth={2}
        aria-hidden
      />
      <span>{likeCount}</span>
    </button>
  );
}

/** 별칭 — 좋아요 단일 반응 버튼 */
export { TemplateLikeButton as ReactionButton };
