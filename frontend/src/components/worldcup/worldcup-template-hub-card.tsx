'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2, Trophy } from 'lucide-react';
import type { WorldCupTemplateSummaryDto } from '@/lib/worldcup/worldcup-template-api';

export function WorldCupTemplateHubCard({
  row,
  currentUserId,
  accessToken,
  onEdit,
  onDelete,
}: {
  row: WorldCupTemplateSummaryDto;
  currentUserId: number | null;
  accessToken: string | null;
  onEdit: (t: WorldCupTemplateSummaryDto) => void;
  onDelete: (t: WorldCupTemplateSummaryDto) => void;
}) {
  const { id, title, description, thumbnailUrl, creatorId } = row;
  const descTrimmed = description?.trim() ? description.trim() : null;
  const isOwner = currentUserId != null && creatorId != null && currentUserId === creatorId;
  const showMenu = Boolean(accessToken && isOwner);

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
    <li className="relative">
      {showMenu ? (
        <div className="absolute right-3 top-3 z-20" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="더 보기"
            className={[
              'inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-white/95 shadow-sm backdrop-blur-sm transition-colors dark:bg-zinc-900/95',
              menuOpen
                ? 'border-violet-400 text-slate-900 dark:border-violet-600 dark:text-zinc-100'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800',
            ].join(' ')}
          >
            <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-[100] mt-1 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
            >
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
            </div>
          )}
        </div>
      ) : null}

      <Link
        href={`/worldcup/${id}`}
        className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/80 transition hover:border-violet-300 hover:shadow-md hover:ring-violet-200/60 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5 dark:hover:border-violet-600/50 dark:hover:ring-violet-500/20"
      >
        <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100 dark:bg-zinc-800">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- API 썸네일 URL
            <img
              src={thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition group-hover:opacity-95"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-zinc-600">
              <Trophy className="size-10 opacity-40" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <span className="font-semibold text-slate-900 line-clamp-2 dark:text-zinc-100">{title}</span>
          {descTrimmed ? (
            <span className="text-xs text-slate-500 line-clamp-2 dark:text-zinc-500">{descTrimmed}</span>
          ) : null}
          <span className="mt-2 text-xs font-medium text-violet-600 dark:text-violet-400">
            플레이하기 →
          </span>
        </div>
      </Link>
    </li>
  );
}
