'use client';

import { Heart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toggleReaction, type CommunityReactionType } from '@/lib/api/community-api';
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
      if (!templateId || busy) return;
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
        if (serverLiked !== nextLiked) {
          setLiked(prevLiked);
          applyCount(prevCount);
          toast.error('좋아요 상태가 맞지 않아요. 잠시 후 다시 시도해 주세요.');
        } else if (!isMember) {
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
    [templateId, busy, liked, likeCount, applyCount, isMember, onMyReactionResolved],
  );

  return (
    <button
      type="button"
      onClick={(e) => void onClick(e)}
      disabled={busy || !templateId}
      aria-pressed={liked}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        liked
          ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
          : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800',
        busy ? 'opacity-60' : '',
        className,
      ].join(' ')}
    >
      <Heart
        className={`h-3.5 w-3.5 shrink-0 ${liked ? 'fill-current' : ''}`}
        strokeWidth={2}
        aria-hidden
      />
      <span className="tabular-nums">{likeCount}</span>
    </button>
  );
}

/** 별칭 — 좋아요 단일 반응 버튼 */
export { TemplateLikeButton as ReactionButton };
