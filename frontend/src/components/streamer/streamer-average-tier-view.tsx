'use client';

import { isTierSpacerId, type TierItem } from '@/lib/store/tier-store';
import type { StreamerTierStats } from '@/lib/streamer/streamer-api';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

type UnplacedKind = 'tie' | 'none';

export interface StreamerAverageTierRow {
  id: string;
  label: string;
  color: string;
  textColor?: string;
}

/**
 * 시청자 집단 통계를 "평균 티어표"로 시각화.
 * - 최다 득표 행 1개 → 그 행에 배치
 * - 1위 동률(2개 이상) → 미분류 + ⚡ 뱃지
 * - 투표 0 → 미분류 기본 카드
 * 모든 카드는 hover 시 분포 툴팁. 방장 라이브 화면과 결과 상세가 공유한다.
 */
export function StreamerAverageTierView({
  tiers,
  itemsById,
  stats,
}: {
  tiers: StreamerAverageTierRow[];
  itemsById: Map<string, TierItem>;
  stats: StreamerTierStats;
}) {
  const rowCount = Math.max(1, tiers.length);
  const statByItem = new Map(stats.items.map((s) => [s.itemId, s]));

  const tooltip = (dist: Record<string, number>): string => {
    const parts = Object.entries(dist)
      .filter(([, v]) => v > 0)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => `${tiers[Number(k)]?.label ?? `#${k}`}: ${v}표`);
    return parts.length ? parts.join(', ') : '투표 없음';
  };

  const rowsItems: Array<Array<{ itemId: string; item: TierItem | undefined }>> = tiers.map(() => []);
  const unclassified: Array<{ itemId: string; item: TierItem | undefined; kind: UnplacedKind; dist: Record<string, number> }> = [];

  for (const itemId of itemsById.keys()) {
    if (isTierSpacerId(itemId)) continue;
    const item = itemsById.get(itemId);
    const dist = statByItem.get(itemId)?.distribution ?? {};
    const entries = Object.entries(dist).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      unclassified.push({ itemId, item, kind: 'none', dist });
      continue;
    }
    const max = Math.max(...entries.map(([, v]) => v));
    const winners = entries.filter(([, v]) => v === max);
    if (winners.length === 1) {
      const row = Math.min(rowCount - 1, Math.max(0, Number(winners[0]![0])));
      rowsItems[row]!.push({ itemId, item });
    } else {
      unclassified.push({ itemId, item, kind: 'tie', dist });
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2">
      <p className="mb-2 px-1 text-[11px] text-zinc-400">
        시청자 최다 득표 행에 배치 · 1위 동률(⚡)·미투표는 아래 미분류에 모여요. 카드에 마우스를 올리면 분포가 보여요. (제출 {stats.totalSubmissions}명)
      </p>

      <div className="flex flex-col gap-1">
        {tiers.map((tier, idx) => (
          <div key={tier.id} className="flex items-stretch gap-1">
            <div
              className="flex w-14 shrink-0 items-center justify-center rounded-l-md text-center text-sm font-bold"
              style={{ backgroundColor: tier.color, color: tier.textColor ?? '#111827' }}
            >
              {tier.label}
            </div>
            <div className="flex min-h-[3.5rem] flex-1 flex-wrap gap-1 rounded-r-md bg-zinc-100 p-1 dark:bg-zinc-800">
              {rowsItems[idx]!.map(({ itemId, item }) => (
                <AverageCard
                  key={itemId}
                  itemId={itemId}
                  item={item}
                  title={tooltip(statByItem.get(itemId)?.distribution ?? {})}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 px-1 text-xs font-semibold text-zinc-500">미분류 {unclassified.length}개</div>
        <div className="flex flex-wrap gap-1 rounded-md border border-dashed border-zinc-300 p-2 dark:border-zinc-700">
          {unclassified.length === 0 ? (
            <span className="px-1 py-2 text-[11px] text-zinc-400">모든 아이템이 배치됐어요.</span>
          ) : (
            unclassified.map(({ itemId, item, kind, dist }) => (
              <AverageCard
                key={itemId}
                itemId={itemId}
                item={item}
                title={kind === 'tie' ? `의견 대립 — ${tooltip(dist)}` : '투표 없음'}
                badge={kind === 'tie' ? '⚡' : undefined}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AverageCard({
  itemId,
  item,
  title,
  badge,
}: {
  itemId: string;
  item: TierItem | undefined;
  title: string;
  badge?: string;
}) {
  return (
    <div className="relative h-14 w-14" title={title}>
      {item?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={picktyImageDisplaySrc(item.imageUrl)}
          alt={item.name || itemId}
          className="h-14 w-14 rounded object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded bg-zinc-200 p-0.5 text-center text-[9px] leading-tight text-zinc-500 dark:bg-zinc-700">
          {item?.name || itemId}
        </div>
      )}
      {badge ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[10px] leading-tight text-white shadow">
          {badge}
        </span>
      ) : null}
    </div>
  );
}
