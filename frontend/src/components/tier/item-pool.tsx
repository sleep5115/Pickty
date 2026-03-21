'use client';

import { useDroppable } from '@dnd-kit/core';
import { TierItem } from '@/lib/store/tier-store';
import { ItemCard } from './item-card';

interface ItemPoolProps {
  items: TierItem[];
  selectedItemIds: string[];
  targetingActive: boolean;
  onClickItem: (itemId: string, e: React.MouseEvent) => void;
}

export function ItemPool({
  items,
  selectedItemIds,
  targetingActive,
  onClickItem,
}: ItemPoolProps) {
  const selectedSet = new Set(selectedItemIds);

  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: 'pool' });

  return (
    <div
      ref={setDropRef}
      className={[
        'shrink-0 border-t-2 transition-colors duration-150',
        isOver
          ? 'bg-slate-200/60 dark:bg-zinc-800/60 border-zinc-400'
          : 'bg-slate-100 dark:bg-zinc-950 border-slate-300 dark:border-zinc-700',
      ].join(' ')}
    >
      {/* 풀 헤더 */}
      <div className="px-2 pt-1.5 pb-1 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider pointer-events-none">
          미분류 아이템
        </span>
        <span className="text-xs text-slate-500 dark:text-zinc-600 pointer-events-none">
          ({items.length})
        </span>
        {selectedItemIds.length > 0 && (
          <span className="text-xs text-violet-400 font-medium pointer-events-none">
            {selectedItemIds.length}개 선택됨 — 드래그로 이동
          </span>
        )}
      </div>

      {/* 아이템 그리드 */}
      <div className="px-2 pb-2 max-h-52 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-slate-500 dark:text-zinc-600 text-sm py-4 text-center">
            모든 아이템이 티어에 배치되었습니다 🎉
          </p>
        ) : (
          <div className="flex flex-row flex-wrap gap-0.5">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selectedSet.has(item.id)}
                targetingActive={targetingActive}
                alreadyInTarget={false}
                onClick={(e) => onClickItem(item.id, e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
