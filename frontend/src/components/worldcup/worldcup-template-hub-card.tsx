'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BarChart3, Link2, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TierItemTileImages } from '@/components/tier/tier-item-tile-images';
import type { WorldCupTemplateSummaryDto } from '@/lib/worldcup/worldcup-template-api';
import {
  freezeRasterImageUrlToJpegDataUrl,
  isLikelyAnimatedGifRasterUrl,
} from '@/lib/worldcup/worldcup-raster-static';

/** GIF 썸네일만 — `key={thumbnailUrl}` 로 URL 변경 시 로딩 상태 리셋 */
function WorldCupTemplateHubFrozenGifThumb({
  thumbnailUrl,
  title,
}: {
  thumbnailUrl: string;
  title: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void freezeRasterImageUrlToJpegDataUrl(thumbnailUrl, 720).then(
      (dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      },
      () => {
        if (!cancelled) setSrc('');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [thumbnailUrl]);

  if (src === null) {
    return (
      <div className="absolute inset-0 min-h-0 w-full animate-pulse bg-slate-300/80 dark:bg-zinc-700/80" aria-hidden />
    );
  }

  if (src === '') {
    return (
      <div className="absolute inset-0 min-h-0 w-full">
        <TierItemTileImages imageUrl={thumbnailUrl} alt={`${title} 썸네일`} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${title} 썸네일`}
      className="absolute inset-0 h-full w-full object-contain"
      draggable={false}
    />
  );
}

function WorldCupTemplateHubThumbnail({
  thumbnailUrl,
  title,
}: {
  thumbnailUrl: string;
  title: string;
}) {
  if (!isLikelyAnimatedGifRasterUrl(thumbnailUrl)) {
    return (
      <div className="absolute inset-0 min-h-0 w-full">
        <TierItemTileImages imageUrl={thumbnailUrl} alt={`${title} 썸네일`} />
      </div>
    );
  }

  return <WorldCupTemplateHubFrozenGifThumb key={thumbnailUrl} thumbnailUrl={thumbnailUrl} title={title} />;
}

const PLAY_URL_ORIGIN = 'https://pickty.app';

export function WorldCupTemplateHubCard({
  row,
  currentUserId,
  isAdmin,
  accessToken,
  onEdit,
  onDelete,
}: {
  row: WorldCupTemplateSummaryDto;
  currentUserId: number | null;
  isAdmin: boolean;
  accessToken: string | null;
  onEdit: (t: WorldCupTemplateSummaryDto) => void;
  onDelete: (t: WorldCupTemplateSummaryDto) => void;
}) {
  const router = useRouter();
  const { id, title, description, thumbnailUrl, creatorId } = row;
  const descTrimmed = description?.trim() ? description.trim() : null;
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

  const playPath = `/worldcup/templates/${encodeURIComponent(id)}`;
  const rankingPath = `/worldcup/templates/${encodeURIComponent(id)}/ranking`;

  const copyShareLink = async () => {
    const url = `${PLAY_URL_ORIGIN}${playPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('링크가 복사되었습니다');
    } catch {
      toast.error('링크를 복사하지 못했습니다');
    }
  };

  const actionGhostBase =
    'inline-flex min-h-9 min-w-0 flex-1 items-center gap-0.5 rounded-none border-0 bg-transparent px-0.5 py-0 text-xs font-medium transition-colors sm:gap-1 sm:px-1 sm:text-sm focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset dark:focus-visible:ring-violet-400';

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative">
        <div
          className="relative aspect-[8/5] w-full shrink-0 overflow-hidden rounded-t-xl border-b border-slate-100 bg-linear-to-br from-slate-200 to-slate-100 dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-900"
        >
          {hasThumb ? (
            <WorldCupTemplateHubThumbnail thumbnailUrl={thumbnailUrl!} title={title} />
          ) : (
            <div className="flex h-full min-h-0 w-full items-center justify-center">
              <span className="select-none text-4xl opacity-40" aria-hidden>
                ◆
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 px-3 py-2.5">
        <span className="line-clamp-1 min-w-0 font-semibold text-slate-900 dark:text-zinc-100">
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
      <div
        className="flex w-full min-w-0 divide-x divide-slate-200 border-t border-slate-200 p-0 dark:divide-zinc-800 dark:border-zinc-800"
        role="group"
        aria-label="템플릿 작업"
      >
        <button
          type="button"
          onClick={() => router.push(playPath)}
          className={`${actionGhostBase} justify-center font-semibold text-[var(--brand-from)] hover:bg-slate-50 dark:hover:bg-zinc-800/70`}
        >
          <Play className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">시작하기</span>
        </button>
        <button
          type="button"
          onClick={() => router.push(rankingPath)}
          className={`${actionGhostBase} justify-center text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800/70`}
        >
          <BarChart3 className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">랭킹보기</span>
        </button>
        <div className="flex min-w-0 flex-1 items-stretch gap-0">
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className={`${actionGhostBase} flex-1 border-0 text-[var(--text-secondary)] hover:bg-slate-50 dark:hover:bg-zinc-800/70 ${showMenu ? 'justify-end pr-0.5 sm:pr-1' : 'justify-center'}`}
          >
            <Link2 className="size-3.5 shrink-0" aria-hidden />
            <span className="shrink-0 whitespace-nowrap">공유</span>
          </button>
          {showMenu ? (
            <div className="relative flex w-8 shrink-0 flex-col" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="더 보기"
                className={[
                  'inline-flex min-h-9 w-full flex-1 items-center justify-center rounded-none border-0 bg-transparent text-[var(--text-secondary)] transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset dark:hover:bg-zinc-800/70 dark:focus-visible:ring-violet-400',
                  menuOpen ? 'text-slate-900 dark:text-zinc-100' : '',
                ].join(' ')}
              >
                <MoreVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-[100] mb-1 min-w-[12rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40"
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
      </div>
    </li>
  );
}
