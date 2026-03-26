'use client';

import { forwardRef } from 'react';
import type { Tier, TierItem } from '@/lib/store/tier-store';
import {
  getTierLabelSurfaceStyle,
  getTierLabelTextStyle,
  tierHasBackgroundImage,
} from '@/lib/tier-label-surface';
import { StaticItemCard } from '@/components/tier/static-item-card';

interface TierBoardReadonlyProps {
  tiers: Tier[];
  pool: TierItem[];
}

/**
 * 편집용 티어 보드와 동일한 행·풀 레이아웃 (드래그/설정 버튼 없음).
 * ref는 `TierBoard`와 같이 **티어 행만** 감쌉니다 — PNG 캡처 시 미분류 풀 제외.
 */
export const TierBoardReadonly = forwardRef<HTMLDivElement, TierBoardReadonlyProps>(
  function TierBoardReadonly({ tiers, pool }, ref) {
    return (
      <div className="flex flex-col border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        <div ref={ref} className="bg-white dark:bg-zinc-900">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="flex flex-row min-h-20 border-b border-slate-200 dark:border-zinc-800 last:border-b-0"
            >
              <div
                className={[
                  'w-20 min-w-[80px] shrink-0 flex items-center justify-center text-2xl font-black select-none',
                  tierHasBackgroundImage(tier) ? '' : 'text-zinc-900',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  ...getTierLabelSurfaceStyle(tier),
                  ...getTierLabelTextStyle(tier),
                }}
              >
                {tier.label}
              </div>
              <div className="flex flex-row flex-wrap gap-1 p-1.5 flex-1 min-h-20 bg-white dark:bg-zinc-900 items-start content-start">
                {tier.items.map((item) => (
                  <StaticItemCard key={item.id} item={item} />
                ))}
              </div>
              {/* TierRow 설정 열 너비 맞춤 (빈 칸) */}
              <div className="w-8 shrink-0 bg-white dark:bg-zinc-900" aria-hidden />
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t-2 bg-slate-100 dark:bg-zinc-950 border-slate-300 dark:border-zinc-700">
          <div className="px-2 pt-1.5 pb-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">
              미분류 아이템
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-600">({pool.length})</span>
          </div>
          <div className="px-2 pb-2 max-h-52 overflow-y-auto">
            {pool.length === 0 ? (
              <p className="text-slate-500 dark:text-zinc-600 text-sm py-4 text-center">
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
