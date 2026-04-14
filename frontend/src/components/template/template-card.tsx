'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { TierItemTileImages } from '@/components/tier/tier-item-tile-images';
import type { ReactionType } from '@/lib/api/interaction-api';
import type { TemplateSummaryResponse } from '@/lib/tier-api';
import { TemplateLikeButton } from '@/components/interaction/template-like-button';
import { ViewCountInline } from '@/components/interaction/view-count-inline';

export function TemplateCard({
  row,
  currentUserId,
  isAdmin,
  accessToken,
  onEdit,
  onDelete,
  onLikeCountChange,
  onMyReactionResolved,
}: {
  row: TemplateSummaryResponse;
  currentUserId: number | null;
  isAdmin: boolean;
  accessToken: string | null;
  onEdit: (t: TemplateSummaryResponse) => void;
  onDelete: (t: TemplateSummaryResponse) => void;
  onLikeCountChange: (templateId: string, likeCount: number) => void;
  onMyReactionResolved?: (templateId: string, reaction: ReactionType | null) => void;
}) {
  const { id, title, description, thumbnailUrl, itemCount, creatorId } = row;
  const descTrimmed = description?.trim() ? description.trim() : null;
  const itemLine = `아이템 ${itemCount}개`;
  const hasThumb = Boolean(thumbnailUrl);
  const isOwner =
    currentUserId != null && creatorId != null && currentUserId === creatorId;
  const showEdit = Boolean(accessToken && (isOwner || isAdmin));
  const showDelete = Boolean(accessToken && (isOwner || isAdmin));
  const showMenu = Boolean(accessToken && (showEdit || showDelete));

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href={`/tier?templateId=${encodeURIComponent(id)}`}
        className="group flex w-full flex-col transition-colors"
      >
        <div
          className="relative aspect-square w-full min-h-[120px] shrink-0 overflow-hidden rounded-t-xl border-b border-slate-100 bg-linear-to-br from-slate-200 to-slate-100 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900"
        >
          {hasThumb ? (
            <div className="absolute inset-0 min-h-0 w-full">
              <TierItemTileImages imageUrl={thumbnailUrl!} alt={`${title} 썸네일`} />
            </div>
          ) : (
            <div className="flex h-full min-h-[120px] w-full items-center justify-center">
              <span
                className="select-none text-4xl opacity-40 transition-opacity group-hover:opacity-60"
                aria-hidden
              >
                ◆
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 px-3 py-2.5">
          <span className="line-clamp-1 min-w-0 font-semibold text-slate-900 transition-colors group-hover:text-violet-700 dark:text-zinc-100 dark:group-hover:text-violet-300">
            {title}
          </span>
          <div className="mt-1 min-h-[calc(2*0.875rem*1.375)] text-sm leading-snug">
            <p
              className={
                descTrimmed
                  ? 'line-clamp-2 text-slate-600 dark:text-zinc-400'
                  : 'line-clamp-2 text-slate-500 dark:text-zinc-500'
              }
            >
              {descTrimmed ?? '설명 없음'}
            </p>
          </div>
        </div>
      </Link>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-3 dark:border-zinc-800/80 rounded-b-xl">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TemplateLikeButton
            appearance="plain"
            templateId={id}
            initialLikeCount={row.likeCount ?? 0}
            initialMyReaction={row.myReaction ?? null}
            onMyReactionResolved={(reaction) => {
              onMyReactionResolved?.(id, reaction);
            }}
            onLikeCountChange={(n) => onLikeCountChange(id, n)}
            className="shrink-0"
          />
          <ViewCountInline count={row.viewCount ?? 0} />
          <span className="min-w-0 truncate text-xs leading-none text-slate-500 dark:text-zinc-500">{itemLine}</span>
        </div>
        {showMenu ? (
          <div className="relative flex shrink-0 items-center justify-center" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="더 보기"
              className={[
                'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                menuOpen
                  ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/40 text-slate-900 dark:text-zinc-100'
                  : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800',
              ].join(' ')}
            >
              <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-[100] mt-1 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
              >
                {showEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(row);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    수정
                  </button>
                )}
                {showDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(row);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </li>
  );
}
