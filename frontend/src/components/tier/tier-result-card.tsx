'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import type { TierResultSummaryResponse } from '@/lib/tier-api';

export function formatTierResultSavedAt(isoLocal: string): string {
  try {
    const d = new Date(isoLocal.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return isoLocal;
    return new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return isoLocal;
  }
}

export type TierResultCardProps = {
  result: TierResultSummaryResponse;
  /** 로그인한 유저 id — 비로그인이면 null */
  currentUserId: number | null;
  isAdmin: boolean;
  accessToken: string | null;
  onEdit: (r: TierResultSummaryResponse) => void;
  onDelete: (r: TierResultSummaryResponse) => void;
};

/**
 * 내 글: 수정 + 삭제(⋮). ADMIN(남의 글): 삭제만. 다시 배치: 항상.
 */
export function TierResultCard({
  result: r,
  currentUserId,
  isAdmin,
  accessToken,
  onEdit,
  onDelete,
}: TierResultCardProps) {
  const isOwner =
    currentUserId != null && r.userId != null && currentUserId === r.userId;
  const showEdit = Boolean(accessToken && isOwner);
  const showDelete = Boolean(accessToken && (isOwner || isAdmin));
  const showOwnerMenu = Boolean(accessToken && (showEdit || showDelete));

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
    <li className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href={`/tier/result/${encodeURIComponent(r.id)}`}
        className="group flex min-h-0 flex-1 flex-col transition-colors hover:border-violet-400 dark:hover:border-violet-600"
      >
        <div
          className="relative w-full shrink-0 overflow-hidden rounded-t-xl border-b border-slate-100 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950"
          style={{ aspectRatio: '16 / 10', minHeight: '140px' }}
        >
          {r.thumbnailUrl ? (
            <div className="absolute inset-0 flex min-h-0 flex-col">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={picktyImageDisplaySrc(r.thumbnailUrl)}
                alt=""
                className="block h-full w-full min-h-0 object-cover object-top"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-600">
              <span className="text-3xl opacity-50" aria-hidden>
                ◇
              </span>
              <span className="text-xs">미리보기 없음</span>
            </div>
          )}
        </div>
        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col gap-1 p-4 ${!showOwnerMenu ? 'rounded-b-xl' : ''}`}
        >
          <span className="font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors line-clamp-2">
            {r.listTitle?.trim() || '제목 없음'}
          </span>
          <span className="text-xs text-slate-500 dark:text-zinc-500 line-clamp-1">
            템플릿: {r.templateTitle} · v{r.templateVersion}
            {r.isPublic ? ' · 공개' : ''}
          </span>
          <span className="text-xs text-slate-400 dark:text-zinc-600 mt-auto pt-2 tabular-nums">
            {formatTierResultSavedAt(r.createdAt)}
          </span>
        </div>
      </Link>
      <div className="flex flex-wrap items-center gap-2 rounded-b-xl border-t border-transparent px-4 pb-4 pt-0">
        <Link
          href={`/tier?templateId=${encodeURIComponent(r.templateId)}&sourceResultId=${encodeURIComponent(r.id)}`}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          다시 배치
        </Link>
        {showOwnerMenu && (
          <div className="relative ml-auto shrink-0" ref={menuRef}>
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
                className="absolute right-0 z-[100] mt-1 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
              >
                {showEdit && (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(r);
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(r);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    삭제
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
