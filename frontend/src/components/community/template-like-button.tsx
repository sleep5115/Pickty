'use client';

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toggleReaction, type CommunityReactionType } from '@/lib/api/community-api';
import { useReactionsInteractiveSurface } from '@/lib/hooks/use-reactions-interactive-surface';
import { useAuthStore } from '@/lib/store/auth-store';
import { getStoredReaction, setStoredReaction } from '@/lib/store/reaction-store';

type Props = {
  templateId: string;
  initialLikeCount: number;
  /** 로그인 시 API `myReaction` — 비회원이면 무시하고 localStorage 사용 */
  initialMyReaction?: CommunityReactionType | null;
  /** 토글 성공 후 부모가 `myReaction` 등을 동기화할 때 */
  onMyReactionResolved?: (reaction: CommunityReactionType | null) => void;
  className?: string;
  onLikeCountChange?: (next: number) => void;
};

export function TemplateLikeButton({
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
        const r = await toggleReaction('TIER_TEMPLATE', templateId, 'LIKE');
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

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={locked || busy || !templateId}
      aria-pressed={liked}
      title={locked ? '티어 만들기 화면에서만 좋아요할 수 있어요' : undefined}
      className={[
        'inline-flex items-center gap-1.5 border-0 bg-transparent px-0 py-0.5 text-xs font-medium tabular-nums transition-colors disabled:cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900',
        liked
          ? 'text-pink-600 dark:text-pink-400'
          : 'text-slate-600 dark:text-zinc-400',
        !locked && !busy && templateId
          ? liked
            ? 'cursor-pointer hover:opacity-90'
            : 'cursor-pointer hover:text-pink-600 dark:hover:text-pink-400'
          : '',
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
