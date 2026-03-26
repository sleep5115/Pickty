'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tier } from '@/lib/store/tier-store';
import {
  getTierLabelSurfaceStyle,
  getTierLabelTextStyle,
  tierHasBackgroundImage,
} from '@/lib/tier-label-surface';
import { ItemCard } from './item-card';
import { TierSettingsModal } from './tier-settings-modal';

interface TierRowProps {
  tier: Tier;
  isTarget: boolean;
  selectedItemIds: string[];
  targetingActive: boolean;
  /** 현재 행 정렬 드래그가 진행 중인지 — 아이템 드롭 하이라이트 억제에 사용 */
  isRowSortActive: boolean;
  onClickTier: () => void;
  onClickItem: (itemId: string, e: React.MouseEvent) => void;
}

export function TierRow({
  tier,
  isTarget,
  selectedItemIds,
  targetingActive,
  isRowSortActive,
  onClickTier,
  onClickItem,
}: TierRowProps) {
  const selectedSet = new Set(selectedItemIds);
  const targetItemIds = new Set(tier.items.map((i) => i.id));
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    attributes,
    listeners: handleListeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: tier.id,
    data: { type: 'tier-row' },
  });

  const rowStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 10, position: 'relative' } : {}),
  };

  // 아이템 드래그 중 hover 하이라이트 (행 정렬 중에는 표시 안 함)
  const showDropHighlight = isOver && !isRowSortActive;

  return (
    <>
      <div
        ref={setNodeRef}
        style={rowStyle}
        className={[
          'flex flex-row min-h-20 border-b border-slate-200 dark:border-zinc-800 transition-all duration-150',
          isDragging ? 'opacity-40' : '',
          isTarget ? 'ring-2 ring-inset ring-violet-500 bg-violet-950/20' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* 티어 라벨 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClickTier();
          }}
          title={
            isTarget
              ? `'${tier.label}' 타겟팅 해제`
              : `'${tier.label}' 티어로 이동 타겟팅`
          }
          className={[
            'w-20 min-w-[80px] flex items-center justify-center',
            'text-2xl font-black select-none',
            tierHasBackgroundImage(tier) ? '' : 'text-zinc-900',
            'transition-all duration-150 shrink-0',
            isTarget
              ? 'brightness-110 ring-2 ring-violet-400'
              : 'hover:brightness-90 cursor-pointer',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            ...getTierLabelSurfaceStyle(tier),
            ...getTierLabelTextStyle(tier),
          }}
        >
          {tier.label}
        </button>

        {/* 아이템 배치 영역 */}
        <div
          className={[
            'flex flex-row flex-wrap gap-1 p-1.5 flex-1 min-h-20 transition-colors duration-150',
            showDropHighlight
              ? 'bg-violet-900/30 ring-2 ring-inset ring-violet-400/60'
              : 'bg-white dark:bg-zinc-900',
          ].join(' ')}
        >
          {tier.items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedSet.has(item.id)}
              targetingActive={targetingActive && !isTarget}
              alreadyInTarget={isTarget && targetItemIds.has(item.id)}
              onClick={(e) => onClickItem(item.id, e)}
            />
          ))}
        </div>

        {/* 설정 버튼 — 캡처 시 제외 */}
        <button
          className={[
            'w-8 shrink-0 flex items-center justify-center',
            'text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-300',
            'bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800',
            'transition-colors text-sm',
          ].join(' ')}
          title="티어 설정"
          onClick={(e) => {
            e.stopPropagation();
            setSettingsOpen(true);
          }}
          data-no-drag-select
          data-capture-ignore="true"
        >
          ⚙
        </button>

        {/* 드래그 핸들 — 캡처 시 제외 */}
        <button
          suppressHydrationWarning
          {...handleListeners}
          {...attributes}
          className={[
            'w-8 shrink-0 flex items-center justify-center',
            'text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-300',
            'bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800',
            'transition-colors cursor-grab active:cursor-grabbing',
            'touch-none select-none',
          ].join(' ')}
          title="드래그하여 순서 변경"
          data-no-drag-select
          data-capture-ignore="true"
          tabIndex={-1}
        >
          <DragHandleIcon />
        </button>
      </div>

      {settingsOpen && (
        <TierSettingsModal
          tier={tier}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

function DragHandleIcon() {
  return (
    <svg
      width="14"
      height="12"
      viewBox="0 0 14 12"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="14" height="2" rx="1" />
      <rect x="0" y="5" width="14" height="2" rx="1" />
      <rect x="0" y="10" width="14" height="2" rx="1" />
    </svg>
  );
}
