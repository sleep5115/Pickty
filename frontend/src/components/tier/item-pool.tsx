'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { TierItem } from '@/lib/store/tier-store';
import { ItemCard } from './item-card';

interface ItemPoolProps {
  items: TierItem[];
  selectedItemIds: string[];
  targetingActive: boolean;
  onClickItem: (itemId: string, e: React.MouseEvent) => void;
  /** `/tier` 플레이 전용 — 미분류 풀 맨 앞에 투명 블록 삽입 */
  onAddSpacer?: () => void;
}

export function ItemPool({
  items,
  selectedItemIds,
  targetingActive,
  onClickItem,
  onAddSpacer,
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
        {onAddSpacer ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddSpacer();
            }}
            className={[
              'text-[11px] font-semibold shrink-0 rounded-md px-2 py-0.5',
              'border border-slate-300 bg-white text-slate-600',
              'hover:bg-slate-50 hover:border-slate-400',
              'dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
              'transition-colors',
            ].join(' ')}
          >
            투명 아이템 생성
          </button>
        ) : null}
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
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="flex flex-row flex-wrap gap-0.5">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  dragMode="sortable"
                  sortableData={{ type: 'pool-item' }}
                  item={item}
                  isSelected={selectedSet.has(item.id)}
                  targetingActive={targetingActive}
                  alreadyInTarget={false}
                  onClick={(e) => onClickItem(item.id, e)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
