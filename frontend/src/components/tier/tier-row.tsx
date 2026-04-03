'use client';

import { useState } from 'react';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Tier, useTierStore } from '@/lib/store/tier-store';
import { TierLabelCellView } from '@/components/tier/tier-label-cell-view';
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
  /** true면 ⚙ 비활성(미리보기 전용 — 설정은 상단 에디터에서) */
  disableTierSettings?: boolean;
  /** true면 행 순서 핸들 비활성(미리보기 전용) */
  disableRowReorder?: boolean;
  /** false면 티어 설정 모달에서 라벨 칸 이미지 업로드 숨김 (`/tier` 플레이) */
  allowLabelImageUpload?: boolean;
}

export function TierRow({
  tier,
  isTarget,
  selectedItemIds,
  targetingActive,
  isRowSortActive,
  onClickTier,
  onClickItem,
  disableTierSettings = false,
  disableRowReorder = false,
  allowLabelImageUpload = true,
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

  const showDropHighlight = isOver && !isRowSortActive;
  /** 캡처 루트(`TierBoard`)의 표 전체 배경이 행 뒤로 비치도록 — 불투명 흰 칸이 이미지를 덮지 않게 함 */
  const itemStripSurface = showDropHighlight
    ? 'bg-violet-900/30 ring-2 ring-inset ring-violet-400/60'
    : 'bg-transparent';
  const railSurface = showDropHighlight ? 'bg-violet-900/30' : 'bg-transparent';

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
        <button
          type="button"
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
            'relative w-20 min-w-[80px] shrink-0 overflow-hidden',
            'transition-all duration-150',
            isTarget
              ? 'brightness-110 ring-2 ring-violet-400'
              : 'hover:brightness-90 cursor-pointer',
          ].join(' ')}
        >
          <TierLabelCellView tier={tier} />
        </button>

        <SortableContext items={tier.items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div
            className={[
              'flex flex-row flex-wrap gap-1 p-1.5 flex-1 min-h-20 transition-colors duration-150',
              itemStripSurface,
            ].join(' ')}
          >
            {tier.items.map((item) => (
              <ItemCard
                key={item.id}
                dragMode="sortable"
                sortableData={{ type: 'tier-item', tierId: tier.id }}
                item={item}
                isSelected={selectedSet.has(item.id)}
                targetingActive={targetingActive && !isTarget}
                alreadyInTarget={isTarget && targetItemIds.has(item.id)}
                onClick={(e) => onClickItem(item.id, e)}
              />
            ))}
          </div>
        </SortableContext>

        {disableTierSettings ? (
          <span
            className={[
              'w-8 shrink-0 flex items-center justify-center',
              'border-l border-slate-200 dark:border-zinc-800',
              railSurface,
              'text-sm text-slate-300 dark:text-zinc-700 pointer-events-none select-none',
            ].join(' ')}
            aria-hidden
            data-capture-ignore="true"
          >
            ⚙
          </span>
        ) : (
          <button
            type="button"
            className={[
              'w-8 shrink-0 flex items-center justify-center',
              'text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-300',
              railSurface,
              'border-l border-slate-200 dark:border-zinc-800',
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
        )}

        {disableRowReorder ? (
          <span
            className={[
              'w-8 shrink-0 flex items-center justify-center',
              'border-l border-slate-200 dark:border-zinc-800',
              railSurface,
              'text-slate-300 dark:text-zinc-700 pointer-events-none select-none',
            ].join(' ')}
            aria-hidden
            data-capture-ignore="true"
          >
            <DragHandleIcon />
          </span>
        ) : (
          <button
            type="button"
            suppressHydrationWarning
            {...handleListeners}
            {...attributes}
            className={[
              'w-8 shrink-0 flex items-center justify-center',
              'text-slate-500 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-zinc-300',
              railSurface,
              'border-l border-slate-200 dark:border-zinc-800',
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
        )}
      </div>

      {settingsOpen && !disableTierSettings && (
        <TierSettingsModal
          tier={tier}
          onClose={() => setSettingsOpen(false)}
          allowLabelImageUpload={allowLabelImageUpload}
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
