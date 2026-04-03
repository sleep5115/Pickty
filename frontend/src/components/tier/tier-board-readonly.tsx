'use client';

import { forwardRef } from 'react';
import type { Tier, TierItem } from '@/lib/store/tier-store';
import type { TemplateBoardSurface } from '@/lib/template-board-config';
import {
  buildWorkspaceBoardSurfaceStyle,
  workspaceBoardSurfaceIsVisual,
} from '@/lib/tier-label-surface';
import { TierLabelCellView } from '@/components/tier/tier-label-cell-view';
import { StaticItemCard } from '@/components/tier/static-item-card';

interface TierBoardReadonlyProps {
  tiers: Tier[];
  pool: TierItem[];
  /** 결과 스냅샷 등 — 표 배경 한 겹(라벨+아이템 공통) */
  boardSurface?: TemplateBoardSurface | null;
}

/**
 * 편집용 티어 보드와 동일한 행·풀 레이아웃 (드래그/설정 버튼 없음).
 * ref는 `TierBoard`와 같이 **티어 행만** 감쌉니다 — PNG 캡처 시 미분류 풀 제외.
 */
export const TierBoardReadonly = forwardRef<HTMLDivElement, TierBoardReadonlyProps>(
  function TierBoardReadonly({ tiers, pool, boardSurface = null }, ref) {
    const hasBoard = workspaceBoardSurfaceIsVisual(boardSurface);
    const boardStyle = buildWorkspaceBoardSurfaceStyle(boardSurface);

    return (
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div ref={ref} className="relative overflow-hidden bg-white dark:bg-zinc-900">
          {hasBoard ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0"
              style={boardStyle}
            />
          ) : null}
          <div className="relative z-[5]">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="flex min-h-20 flex-row items-stretch border-b border-slate-200 last:border-b-0 dark:border-zinc-800"
              >
                <div className="relative flex min-h-20 w-20 min-w-[80px] shrink-0 flex-col overflow-hidden">
                  <TierLabelCellView tier={tier} />
                </div>
                <div className="flex min-h-20 min-w-0 flex-1 flex-row flex-wrap content-start items-start gap-1 bg-transparent p-1.5">
                  {tier.items.map((item) => (
                    <StaticItemCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-slate-300 bg-slate-100 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              미분류 아이템
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-600">({pool.length})</span>
          </div>
          <div className="max-h-52 overflow-y-auto px-2 pb-2">
            {pool.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-500 dark:text-zinc-600">
                모든 아이템이 티어에 배치되었습니다
              </p>
            ) : (
              <div className="flex flex-row flex-wrap gap-0.5">
                {pool.map((item) => (
                  <StaticItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);
