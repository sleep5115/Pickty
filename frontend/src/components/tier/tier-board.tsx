'use client';

import { RefObject, useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTierStore } from '@/lib/store/tier-store';
import { usePointerDevice } from '@/hooks/use-pointer-device';
import { useDragSelect } from '@/hooks/use-drag-select';
import { TierRow } from './tier-row';
import { ItemPool } from './item-pool';
import { ItemCard } from './item-card';
import { ExportModal } from './export-modal';

interface TierBoardProps {
  /** tier/page.tsx 루트 ref — drag-select 범위를 toolbar·footer 포함 전체로 확장 */
  dragSelectRef?: RefObject<HTMLElement | null>;
  /**
   * false: SSR·첫 하이드레이션과 동일하게 PC 모드로 간주 (matchMedia와 무관하게 isFine=true)
   * 티어 페이지에서 deviceReady와 함께 쓰면 안내 문구·드래그 선택 동작이 어긋나지 않음
   */
  pointerModeReady?: boolean;
}

export function TierBoard({ dragSelectRef, pointerModeReady = true }: TierBoardProps) {
  const {
    tiers,
    pool,
    selectedItemIds,
    targetTierId,
    toggleTargetTier,
    clearTarget,
    moveItems,
    reorderTiers,
    selectItems,
    clearSelection,
    toggleItemSelection,
  } = useTierStore();

  const { isPointerFine } = usePointerDevice();
  const isFine = pointerModeReady ? (isPointerFine ?? true) : true;

  const targetTierLabel = tiers.find((t) => t.id === targetTierId)?.label;
  const targetingActive = targetTierId !== null;

  // ─── 내보내기 모달 ────────────────────────────────────────────────────────
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isServerSaveOpen, setIsServerSaveOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  // ─── Drag & Drop ─────────────────────────────────────────────────────────
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const isRowSortActive = activeRowId !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 8px 이상 움직여야 드래그 시작 — 클릭과 충돌 방지
      activationConstraint: { distance: 8 },
    }),
  );

  const tierIds = tiers.map((t) => t.id);

  const allItems = [...tiers.flatMap((t) => t.items), ...pool];
  const activeItem = activeItemId
    ? allItems.find((i) => i.id === activeItemId)
    : null;

  const isDraggingMultiple =
    activeItemId !== null &&
    selectedItemIds.includes(activeItemId) &&
    selectedItemIds.length > 1;

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    if (event.active.data.current?.type === 'tier-row') {
      // 행 정렬 드래그
      setActiveRowId(draggedId);
    } else {
      // 아이템 드래그
      setActiveItemId(draggedId);
      if (!selectedItemIds.includes(draggedId)) {
        clearSelection();
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // 행 정렬 완료
    if (active.data.current?.type === 'tier-row') {
      setActiveRowId(null);
      if (over && active.id !== over.id) {
        reorderTiers(active.id as string, over.id as string);
      }
      return;
    }

    // 아이템 드롭 완료
    setActiveItemId(null);
    if (!over) return;

    const itemId = active.id as string;
    const toId = over.id as string;

    const idsToMove =
      selectedItemIds.includes(itemId) && selectedItemIds.length > 0
        ? selectedItemIds
        : [itemId];

    moveItems(idsToMove, toId);
    clearSelection();
  };

  // ─── Marquee Selection (PC 전용) ─────────────────────────────────────────
  const boardRef = useRef<HTMLDivElement>(null);
  // drag-select 직후 click 이벤트가 boardRef까지 버블링되어 clearSelection()을 호출하는 것을 방지
  const justDragSelectedRef = useRef(false);

  const handleDragSelectComplete = useCallback(
    (itemIds: string[]) => {
      justDragSelectedRef.current = true;
      setTimeout(() => { justDragSelectedRef.current = false; }, 50);
      clearSelection();
      selectItems(itemIds);
    },
    [selectItems, clearSelection],
  );

  const { dragSelectRect } = useDragSelect({
    // dragSelectRef(페이지 루트)가 있으면 toolbar·footer 포함 전체 영역, 없으면 보드 영역만
    containerRef: dragSelectRef ?? boardRef,
    // 타겟팅 모드, 아이템 드래그 중, 행 정렬 중에는 범위 선택 비활성화
    enabled:
      isFine && !targetingActive && activeItemId === null && !isRowSortActive,
    onSelect: handleDragSelectComplete,
  });

  // ─── Click handlers ───────────────────────────────────────────────────────
  const handleClickTier = (tierId: string) => {
    toggleTargetTier(tierId);
  };

  const handleClickItem = (itemId: string, e: React.MouseEvent) => {
    if (targetTierId) {
      const targetTier = tiers.find((t) => t.id === targetTierId);
      if (targetTier?.items.some((i) => i.id === itemId)) return;
      moveItems([itemId], targetTierId);
    } else if (isFine && (e.ctrlKey || e.metaKey)) {
      toggleItemSelection(itemId);
    }
  };

  const handleClickEmpty = () => {
    if (justDragSelectedRef.current) return;
    if (targetingActive) clearTarget();
    clearSelection();
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
    >
      <div
        ref={boardRef}
        className="flex flex-col relative select-none"
        onClick={handleClickEmpty}
      >
        {/* 타겟팅 모드 토스트 — 페이지 스크롤 시에도 항상 상단에 고정 */}
        <div
          className={[
            'fixed top-16 left-1/2 -translate-x-1/2 z-50',
            'flex items-center gap-3 px-4 py-2 rounded-xl',
            'bg-violet-950/90 border border-violet-500/60',
            'shadow-lg shadow-violet-950/50 backdrop-blur-sm',
            'text-sm text-violet-200 whitespace-nowrap',
            'transition-all duration-200',
            targetingActive
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 -translate-y-2 pointer-events-none',
          ].join(' ')}
        >
          <span>
            <span className="font-bold text-violet-300">[{targetTierLabel}]</span>
            {' '}티어 타겟팅 중 — 아이템 클릭 시 이동
          </span>
          <button
            onClick={clearTarget}
            className="text-xs text-violet-400 hover:text-violet-100 border border-violet-700 hover:border-violet-400 rounded px-2 py-0.5 transition-colors"
          >
            ESC
          </button>
        </div>

        {/* 티어 행 영역 */}
        <div>
          {/* 캡처 영역 — Item Pool 제외, 티어 행만 포함 */}
          <div ref={captureRef} className="relative bg-white dark:bg-zinc-900">
            <SortableContext items={tierIds} strategy={verticalListSortingStrategy}>
              {tiers.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  isTarget={targetTierId === tier.id}
                  selectedItemIds={selectedItemIds}
                  targetingActive={targetingActive}
                  isRowSortActive={isRowSortActive}
                  onClickTier={() => handleClickTier(tier.id)}
                  onClickItem={handleClickItem}
                />
              ))}
            </SortableContext>
            <div
              className="pointer-events-none absolute bottom-2 right-2 z-10 select-none"
              aria-hidden
            >
              <span
                className="text-[10px] sm:text-[11px] font-black tracking-tight bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent opacity-[0.88] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
              >
                pickty.app
              </span>
            </div>
          </div>
        </div>

        {/* 저장(서버) | 다운로드(PNG) — 모달에서 제목·설명 입력 후 분기 */}
        <div className="flex justify-end px-3 py-2 bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExportOpen(true); }}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold',
              'bg-violet-600 hover:bg-violet-500 text-white',
              'transition-all active:scale-95 shadow-lg shadow-violet-900/30',
            ].join(' ')}
          >
            <FloppyDiskIcon />
            저장
            <span className="opacity-30 font-thin mx-0.5">|</span>
            다운로드
            <DownloadBoxIcon />
          </button>
        </div>

        {/* 미분류 아이템 풀 */}
        <ItemPool
          items={pool}
          selectedItemIds={selectedItemIds}
          targetingActive={targetingActive}
          onClickItem={handleClickItem}
        />

        {/* 범위 선택 박스 (PC 전용) */}
        {dragSelectRect &&
          dragSelectRect.width > 4 &&
          dragSelectRect.height > 4 && (
            <div
              className="pointer-events-none fixed z-40 border-2 border-violet-400 bg-violet-400/10 rounded-sm"
              style={{
                left: dragSelectRect.left,
                top: dragSelectRect.top,
                width: dragSelectRect.width,
                height: dragSelectRect.height,
              }}
            />
          )}
      </div>

      {/* 내보내기 모달 */}
      {isExportOpen && (
        <ExportModal
          captureRef={captureRef}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* 드래그 중 커서를 따라다니는 아이템 미리보기 (아이템 드래그 시에만) */}
      <DragOverlay dropAnimation={null}>
        {activeItem && (
          <div className="relative cursor-grabbing drop-shadow-2xl">
            <ItemCard item={activeItem} disableDrag />
            {isDraggingMultiple && (
              <span className="absolute -top-1.5 -right-1.5 bg-violet-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-lg pointer-events-none">
                {selectedItemIds.length}
              </span>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function FloppyDiskIcon() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 15 15"
      fill="none" stroke="currentColor"
      strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 외곽 — 직사각형 (문서 아이콘의 귀퉁이 접힘 없음) */}
      <rect x="1.5" y="1.5" width="12" height="12" rx="1" />
      {/* 라벨 창 (상단 좌측) */}
      <rect x="3.5" y="1.5" width="5" height="4.5" rx="0" />
      {/* 금속 셔터 (하단 전체 폭) */}
      <rect x="3" y="8.5" width="9" height="4.5" rx="0.6" />
    </svg>
  );
}

function DownloadBoxIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* 화살표 shaft */}
      <line x1="7.5" y1="1.5" x2="7.5" y2="9.5" />
      {/* 화살표 머리 */}
      <polyline points="4.5,6.5 7.5,9.5 10.5,6.5" />
      {/* 상자 (트레이) */}
      <path d="M2 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}
