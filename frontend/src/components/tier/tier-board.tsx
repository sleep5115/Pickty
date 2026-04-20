'use client';

import Link from 'next/link';
import { RefObject, ReactNode, useCallback, useRef, useState } from 'react';
import { GitBranch } from 'lucide-react';
import {
  closestCorners,
  DndContext,
  type Collision,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  DragStartEvent,
  getFirstCollision,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuthStore } from '@/lib/store/auth-store';
import { reorderItemNextToRef, useTierStore } from '@/lib/store/tier-store';
import { usePointerDevice } from '@/hooks/use-pointer-device';
import { useDragSelect } from '@/hooks/use-drag-select';
import { TierRow } from './tier-row';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { ItemPool } from './item-pool';
import { ItemCard } from './item-card';
import { ExportModal } from './export-modal';

/**
 * `closestCorners`는 ‘드래그 중인 카드 rect’ 기준이라, 아래쪽 빈 티어 줄 위에 있어도
 * 위쪽 S/A 아이템이 더 가깝다고 잡히는 경우가 많음. 포인터가 실제로 들어 있는 droppable을
 * 우선하고, 겹치면 면적이 작은 쪽(카드 > 행)을 먼저 쓴다.
 */
function collisionsFromPointerInside(
  args: Parameters<CollisionDetection>[0],
): Collision[] | null {
  const { pointerCoordinates, droppableContainers, droppableRects } = args;
  if (!pointerCoordinates) return null;
  const { x, y } = pointerCoordinates;

  const hits: { area: number; container: (typeof droppableContainers)[number] }[] = [];
  for (const container of droppableContainers) {
    if (container.disabled) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    hits.push({
      area: rect.width * rect.height,
      container,
    });
  }
  if (hits.length === 0) return null;

  hits.sort((a, b) => a.area - b.area);
  return hits.map((h) => ({
    id: h.container.id,
    data: {
      droppableContainer: h.container,
      value: h.area,
    },
  }));
}

/** 드래그 타일 중심이 기준 카드 중심보다 오른쪽이면 ‘그 뒤’에 삽입 */
function insertAfterFromPointer(
  event: Pick<DragEndEvent, 'active' | 'over'> | Pick<DragOverEvent, 'active' | 'over'>,
): boolean {
  const { active, over } = event;
  if (!over) return false;
  const translated = active.rect.current.translated;
  if (!translated || translated.width <= 0) return false;
  const activeMidX = translated.left + translated.width / 2;
  const overMidX = over.rect.left + over.rect.width / 2;
  return activeMidX > overMidX;
}

interface TierBoardProps {
  /** tier/page.tsx 루트 ref — drag-select 범위를 toolbar·footer 포함 전체로 확장 */
  dragSelectRef?: RefObject<HTMLElement | null>;
  /**
   * false: SSR·첫 하이드레이션과 동일하게 PC 모드로 간주 (matchMedia와 무관하게 isFine=true)
   * 티어 페이지에서 deviceReady와 함께 쓰면 안내 문구·드래그 선택 동작이 어긋나지 않음
   */
  pointerModeReady?: boolean;
  /** 저장·다운로드 버튼 왼쪽에 붙는 슬롯 (예: 템플릿 좋아요) */
  templateLikeSlot?: ReactNode;
  /** `/tier/template/new` 하단 — 저장·보내기 없이 풀·DnD만 */
  variant?: 'full' | 'template-preview';
  /** false: `/tier` — 티어 설정에서 라벨 이미지 업로드 비노출 */
  allowLabelImageUpload?: boolean;
}

export function TierBoard({
  dragSelectRef,
  pointerModeReady = true,
  templateLikeSlot,
  variant = 'full',
  allowLabelImageUpload = true,
}: TierBoardProps) {
  const {
    tiers,
    pool,
    selectedItemIds,
    targetTierId,
    toggleTargetTier,
    clearTarget,
    moveItems,
    reorderPoolItems,
    reorderTierItems,
    moveItemsToPoolBefore,
    moveItemsToTierBefore,
    reorderTiers,
    selectItems,
    clearSelection,
    toggleItemSelection,
    addPoolSpacer,
  } = useTierStore();
  const templateId = useTierStore((s) => s.templateId);
  const workspaceBoardSurface = useTierStore((s) => s.workspaceBoardSurface);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTemplatePreview = variant === 'template-preview';
  const { isPointerFine } = usePointerDevice();
  const isFine = pointerModeReady ? (isPointerFine ?? true) : true;

  const targetTierLabel = tiers.find((t) => t.id === targetTierId)?.label;
  const targetingActive = targetTierId !== null;

  // ─── 내보내기 모달 ────────────────────────────────────────────────────────
  const [isExportOpen, setIsExportOpen] = useState(false);
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

  /**
   * Sortable은 `over`가 바뀌면 형제 카드 transform으로 ‘자리’를 미리 비운다.
   * 드롭 규칙(가로 중심)상 순서가 안 바뀌는데도 `closestCorners`만으로는 `over`가 옆 카드로 잡혀
   * 유령 슬롯만 움직이는 현상이 난다 → 그럴 땐 `over`를 active로 고정.
   */
  const tierItemCollisionDetection = useCallback<CollisionDetection>((args) => {
    const { active } = args;
    if (!active) return closestCorners(args);
    if (active.data.current?.type === 'tier-row') {
      return closestCorners(args);
    }

    const pointerCollisions = collisionsFromPointerInside(args);
    const base = pointerCollisions ?? closestCorners(args);

    const activeId = String(active.id);
    const hitId = getFirstCollision(base, 'id');
    if (hitId == null) return base;
    const overId = String(hitId);
    if (overId === activeId) return base;

    const { pool, tiers, selectedItemIds } = useTierStore.getState();
    const idsToMove =
      selectedItemIds.includes(activeId) && selectedItemIds.length > 0
        ? selectedItemIds
        : [activeId];
    if (idsToMove.length !== 1) return base;

    let list: { id: string }[] | null = null;
    const activeInPool = pool.some((i) => i.id === activeId);
    const overInPool = pool.some((i) => i.id === overId);
    if (activeInPool && overInPool) {
      list = pool;
    } else {
      const overTier = tiers.find((t) => t.items.some((i) => i.id === overId));
      const activeTier = tiers.find((t) => t.items.some((i) => i.id === activeId));
      if (overTier && activeTier && overTier.id === activeTier.id) {
        list = activeTier.items;
      }
    }
    if (!list) return base;

    const translated = active.rect.current.translated;
    const overRect = args.droppableRects.get(overId);
    if (!translated || translated.width <= 0 || !overRect) return base;

    const insertAfter =
      translated.left + translated.width / 2 > overRect.left + overRect.width / 2;
    const next = reorderItemNextToRef(list, activeId, overId, insertAfter);
    if (!next || next.every((it, i) => it.id === list[i]?.id)) {
      const activeContainer = args.droppableContainers.find((c) => c.id === active.id);
      if (activeContainer) {
        return [
          {
            id: active.id,
            data: { droppableContainer: activeContainer, value: 0 },
          },
        ];
      }
    }

    return base;
  }, []);

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

  /**
   * Sortable 기본 transform은 ‘over 인덱스’ 기준이라, 드롭 시 쓰는 가로 중심(앞/뒤 삽입)과 어긋날 수 있음.
   * 같은 풀·같은 티어 행 안(단일 카드)에서는 드래그 중에도 동일 규칙으로 순서를 맞춰 미리보기=결과로 만든다.
   */
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      if (active.data.current?.type === 'tier-row') return;

      const itemId = active.id as string;
      const overId = over.id as string;

      const { selectedItemIds, pool, tiers } = useTierStore.getState();
      const idsToMove =
        selectedItemIds.includes(itemId) && selectedItemIds.length > 0
          ? selectedItemIds
          : [itemId];
      if (idsToMove.length !== 1) return;
      if (idsToMove[0] === overId) return;

      const insertAfter = insertAfterFromPointer(event);

      const overIsPoolItem = pool.some((i) => i.id === overId);
      if (
        overIsPoolItem &&
        pool.some((i) => i.id === itemId) &&
        itemId !== overId
      ) {
        reorderPoolItems(itemId, overId, insertAfter);
        return;
      }

      const overAsTierSlot = tiers.find((t) => t.items.some((i) => i.id === overId));
      if (!overAsTierSlot) return;

      const activeTier = tiers.find((t) => t.items.some((i) => i.id === itemId));
      if (
        activeTier &&
        activeTier.id === overAsTierSlot.id &&
        itemId !== overId
      ) {
        reorderTierItems(overAsTierSlot.id, itemId, overId, insertAfter);
      }
    },
    [reorderPoolItems, reorderTierItems],
  );

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
    const overId = over.id as string;

    const idsToMove =
      selectedItemIds.includes(itemId) && selectedItemIds.length > 0
        ? selectedItemIds
        : [itemId];

    if (idsToMove.length === 1 && idsToMove[0] === overId) {
      clearSelection();
      return;
    }

    const insertAfter = insertAfterFromPointer(event);

    const { pool, tiers } = useTierStore.getState();
    const tierIdSet = new Set(tiers.map((t) => t.id));
    const overIsPoolItem = pool.some((i) => i.id === overId);
    const overIsPoolDroppable = overId === 'pool';
    const overIsTierRow = tierIdSet.has(overId);

    // 미분류 풀 안에서만 순서 변경 (단일 카드)
    if (
      idsToMove.length === 1 &&
      overIsPoolItem &&
      pool.some((i) => i.id === itemId) &&
      itemId !== overId
    ) {
      reorderPoolItems(itemId, overId, insertAfter);
      clearSelection();
      return;
    }

    // 티어 → 풀: 다른 풀 카드 위에 놓으면 그 앞에 삽입
    if (overIsPoolItem) {
      const allFromPool = idsToMove.every((id) => pool.some((i) => i.id === id));
      if (!allFromPool) {
        moveItemsToPoolBefore(idsToMove, overId, insertAfter);
        clearSelection();
        return;
      }
      moveItems(idsToMove, 'pool');
      clearSelection();
      return;
    }

    const overAsTierSlot = tiers.find((t) => t.items.some((i) => i.id === overId));
    if (overAsTierSlot) {
      const activeTier = tiers.find((t) => t.items.some((i) => i.id === itemId));
      const sameRowSingle =
        idsToMove.length === 1 &&
        activeTier != null &&
        activeTier.id === overAsTierSlot.id &&
        itemId !== overId;
      if (sameRowSingle) {
        reorderTierItems(overAsTierSlot.id, itemId, overId, insertAfter);
      } else {
        moveItemsToTierBefore(idsToMove, overAsTierSlot.id, overId, insertAfter);
      }
      clearSelection();
      return;
    }

    if (overIsTierRow) {
      moveItems(idsToMove, overId);
      clearSelection();
      return;
    }

    if (overIsPoolDroppable) {
      moveItems(idsToMove, 'pool');
      clearSelection();
      return;
    }

    moveItems(idsToMove, 'pool');
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

  const captureSurfaceStyle: React.CSSProperties = {};
  const bc = workspaceBoardSurface?.backgroundColor?.trim();
  const bu = workspaceBoardSurface?.backgroundUrl?.trim();
  if (bc) captureSurfaceStyle.backgroundColor = bc;
  if (bu) {
    captureSurfaceStyle.backgroundImage = `url("${picktyImageDisplaySrc(bu)}")`;
    captureSurfaceStyle.backgroundSize = 'cover';
    captureSurfaceStyle.backgroundPosition = 'center';
    captureSurfaceStyle.backgroundRepeat = 'no-repeat';
  }

  const hasBoardSurface = Boolean(bc || bu);
  /** 캡처 루트 바탕 — 표배경은 라벨·아이템 열만 덮고, ⚙·핸들 열은 이 색 유지 */
  const captureChromeClass = 'bg-white dark:bg-zinc-900';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={tierItemCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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

        {/* 티어 행 영역 — 캡처는 티어 행만 (Item Pool 제외), 워터마크는 PNG 다운로드 시에만 삽입 */}
        <div>
          <div
            ref={captureRef}
            className={['relative overflow-hidden', captureChromeClass].join(' ')}
          >
            {hasBoardSurface ? (
              <div
                aria-hidden
                data-tier-board-surface
                className="pointer-events-none absolute left-0 top-0 bottom-0 z-0"
                style={{
                  width: 'calc(100% - 4rem)',
                  ...captureSurfaceStyle,
                }}
              />
            ) : null}
            <div className="relative z-[5]">
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
                    disableTierSettings={isTemplatePreview}
                    disableRowReorder={isTemplatePreview}
                    allowLabelImageUpload={allowLabelImageUpload}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          <p
            className="px-3 py-2 text-center text-xs text-slate-500 dark:text-zinc-600 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/50"
            onClick={(e) => e.stopPropagation()}
          >
            {isTemplatePreview ? (
              <>
                위에서 편집한 도화지가 실시간으로 반영됩니다. 미분류에서 티어로 끌어다 놓거나, 라벨 타겟팅으로 배치해
                보세요.
              </>
            ) : isFine ? (
              <>
                <span className="text-slate-600 dark:text-zinc-500">타겟팅:</span> 라벨 클릭 → 아이템 클릭
                &nbsp;|&nbsp;
                <span className="text-slate-600 dark:text-zinc-500">범위 선택:</span> 빈 공간 드래그
                &nbsp;|&nbsp;
                <span className="text-slate-600 dark:text-zinc-500">Ctrl+클릭:</span> 개별 추가 선택
                &nbsp;|&nbsp;
                <span className="text-slate-600 dark:text-zinc-500">Alt+클릭:</span> 이미지 확대 / 확대 중엔 닫기
                &nbsp;|&nbsp;
                <span className="text-slate-600 dark:text-zinc-500">확대:</span> ←→ 이전·다음
                &nbsp;|&nbsp;
                선택 후 드래그로 일괄 이동
              </>
            ) : (
              <>
                티어 라벨을 터치하여 활성화 → 아이템을 터치하면 이동 &nbsp;|&nbsp; 빈 공간 터치로 해제
                &nbsp;|&nbsp; 이미지 확대는 카드의 돋보기 · 확대 중 좌우 스와이프로 이전·다음
              </>
            )}
          </p>
        </div>

        {/* 파생(왼쪽) · 저장(서버) | 다운로드(PNG) — 모달에서 제목·설명 입력 후 분기 */}
        {!isTemplatePreview ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800">
          <div className="min-w-0 flex-1 flex items-center">
            {templateId ? (
              <Link
                href={
                  accessToken
                    ? `/tier/template/new?forkTemplateId=${encodeURIComponent(templateId)}`
                    : `/login?returnTo=${encodeURIComponent(`/tier/template/new?forkTemplateId=${templateId}`)}`
                }
                onClick={(e) => e.stopPropagation()}
                className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-violet-400/70 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-900 shadow-sm transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/45 dark:text-violet-100 dark:hover:bg-violet-950/75"
              >
                <GitBranch className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="min-w-0 text-left leading-snug line-clamp-2">
                  이 템플릿을 바탕으로 새 템플릿 만들기
                </span>
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {templateLikeSlot}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (targetTierId !== null) {
                  clearTarget();
                  clearSelection();
                  return;
                }
                setIsExportOpen(true);
              }}
              className={[
                'flex shrink-0 items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold',
                'bg-violet-600 hover:bg-violet-500 text-white',
                'transition-all shadow-lg shadow-violet-900/30',
                targetTierId === null ? 'active:scale-95' : '',
              ].join(' ')}
            >
              <FloppyDiskIcon />
              저장
              <span className="opacity-30 font-thin mx-0.5">|</span>
              다운로드
              <DownloadBoxIcon />
            </button>
          </div>
        </div>
        ) : null}

        {/* 미분류 아이템 풀 */}
        <ItemPool
          items={pool}
          selectedItemIds={selectedItemIds}
          targetingActive={targetingActive}
          onClickItem={handleClickItem}
          onAddSpacer={isTemplatePreview ? undefined : addPoolSpacer}
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
      {!isTemplatePreview && isExportOpen && (
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
