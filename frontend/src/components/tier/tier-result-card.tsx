'use client';

import Link from 'next/link';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
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
 * 내 글: 수정 + 삭제. ADMIN(남의 글): 삭제만. 다시 배치: 항상.
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

  return (
    <li className="flex flex-col rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm h-full">
      <Link
        href={`/tier/result/${encodeURIComponent(r.id)}`}
        className="group flex flex-col flex-1 min-h-0 hover:border-violet-400 dark:hover:border-violet-600 transition-colors"
      >
        <div
          className="relative w-full shrink-0 overflow-hidden border-b border-slate-100 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-950"
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
        <div className="p-4 flex flex-col gap-1 flex-1 min-w-0">
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
      <div className="flex flex-wrap gap-2 px-4 pb-4 pt-0 border-t border-transparent">
        <Link
          href={`/tier?templateId=${encodeURIComponent(r.templateId)}&sourceResultId=${encodeURIComponent(r.id)}`}
          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
          다시 배치
        </Link>
        {showEdit && (
          <button
            type="button"
            onClick={() => onEdit(r)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
            수정
          </button>
        )}
        {showDelete && (
          <button
            type="button"
            onClick={() => onDelete(r)}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            삭제
          </button>
        )}
      </div>
    </li>
  );
}
