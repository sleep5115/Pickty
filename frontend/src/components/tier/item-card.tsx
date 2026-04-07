'use client';

import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ZoomIn } from 'lucide-react';
import { TierItemTileImages } from '@/components/tier/tier-item-tile-images';
import { isTierSpacerId, TierItem, useTierStore } from '@/lib/store/tier-store';

export function hashColor(str: string): string {
  const COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#22c55e', '#06b6d4',
    '#3b82f6', '#a855f7',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export interface ItemCardProps {
  item: TierItem;
  isSelected?: boolean;
  targetingActive?: boolean;
  alreadyInTarget?: boolean;
  /** DragOverlay 내 렌더링 시 drag 훅 비활성화 */
  disableDrag?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** `dragMode="sortable"`일 때만 — DnD data(행 구분 등) */
  sortableData?: Record<string, unknown>;
}

function ItemCardChrome({
  item,
  isSelected = false,
  targetingActive = false,
  alreadyInTarget = false,
  disableDrag = false,
  onClick,
  setNodeRef,
  attributes,
  listeners,
  outerStyle,
  isDragging,
}: ItemCardProps & {
  setNodeRef: (node: HTMLElement | null) => void;
  attributes: ReturnType<typeof useDraggable>['attributes'];
  listeners: ReturnType<typeof useDraggable>['listeners'];
  outerStyle: React.CSSProperties | undefined;
  isDragging: boolean;
}) {
  const isSpacer = isTierSpacerId(item.id);
  const setPreviewItem = useTierStore((s) => s.setPreviewItem);

  const listenerMap = (listeners ?? {}) as Record<string, unknown> & {
    onPointerDown?: React.PointerEventHandler<HTMLButtonElement>;
  };
  const { onPointerDown: dndOnPointerDown, ...listenersRest } = listenerMap;

  const initials = item.name.slice(0, 2);
  const bgColor = hashColor(item.id);
  const showPreviewBtn =
    Boolean(item.imageUrl) && !isSpacer && !alreadyInTarget && !disableDrag;

  return (
    <div
      ref={setNodeRef}
      style={outerStyle}
      data-tier-spacer={isSpacer ? 'true' : undefined}
      className={[
        'relative w-16 h-16 group',
        isSpacer ? 'hidden sm:block' : '',
        isDragging ? 'z-10' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        suppressHydrationWarning
        type="button"
        {...listenersRest}
        {...attributes}
        data-item-id={item.id}
        onPointerDown={(e) => {
          if (
            e.altKey &&
            item.imageUrl &&
            !alreadyInTarget &&
            !disableDrag
          ) {
            e.stopPropagation();
            return;
          }
          dndOnPointerDown?.(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (
            e.altKey &&
            item.imageUrl &&
            !alreadyInTarget &&
            !disableDrag
          ) {
            e.preventDefault();
            setPreviewItem(item);
            return;
          }
          onClick?.(e);
        }}
        disabled={alreadyInTarget}
        title={isSpacer ? '투명 블록 — 드래그하여 간격 조절' : item.name}
        aria-label={isSpacer ? '투명 블록, 드래그하여 간격 조절' : undefined}
        style={{
          backgroundColor: !item.imageUrl && !isSpacer ? bgColor : undefined,
        }}
        className={[
          'absolute inset-0 w-full h-full flex items-center justify-center',
          'text-xs font-bold text-white rounded select-none touch-none',
          'border-2 overflow-hidden',
          'transition-[border,box-shadow,opacity,transform] duration-150',
          isSpacer
            ? [
                'border-dashed border-slate-400/80 dark:border-zinc-500/80',
                'bg-transparent',
                isDragging
                  ? 'opacity-40 cursor-grabbing'
                  : alreadyInTarget
                    ? 'opacity-40 border-slate-400 dark:border-zinc-600 cursor-not-allowed'
                    : 'cursor-grab active:scale-95',
              ].join(' ')
            : isDragging
              ? 'opacity-20 cursor-grabbing'
              : alreadyInTarget
                ? 'opacity-40 border-slate-400 dark:border-zinc-600 cursor-not-allowed'
                : 'hover:brightness-110 cursor-grab active:scale-95',
          isSelected
            ? 'border-violet-400 ring-2 ring-violet-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 scale-105'
            : isSpacer
              ? ''
              : 'border-transparent',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {!isSpacer && item.imageUrl ? (
          <TierItemTileImages imageUrl={item.imageUrl} alt={item.name} />
        ) : !isSpacer ? (
          <span className="text-center leading-tight px-0.5 drop-shadow pointer-events-none">
            {initials}
          </span>
        ) : null}

        {targetingActive && !alreadyInTarget && (
          <span className="pointer-events-none absolute inset-0 z-[15] rounded bg-violet-400/10" />
        )}

        {isSelected && (
          <span className="pointer-events-none absolute inset-0 z-[15] rounded bg-violet-400/20" />
        )}
      </button>

      {showPreviewBtn && (
        <button
          type="button"
          data-capture-ignore="true"
          aria-label={`${item.name} 이미지 크게 보기`}
          className={[
            'absolute top-0.5 right-0.5 z-20 rounded p-0.5 touch-manipulation',
            'border border-slate-200/90 dark:border-zinc-600/90',
            'bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-200 shadow-sm',
            'hover:bg-white dark:hover:bg-zinc-800 transition-opacity duration-150',
            'md:opacity-0 md:group-hover:opacity-100 max-md:opacity-45',
          ].join(' ')}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setPreviewItem(item);
          }}
        >
          <ZoomIn className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      )}
    </div>
  );
}

function ItemCardDraggable(props: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: props.item.id,
      disabled: props.alreadyInTarget || props.disableDrag,
    });

  const outerStyle = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <ItemCardChrome
      {...props}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      outerStyle={outerStyle}
      isDragging={isDragging}
    />
  );
}

function ItemCardSortable(props: ItemCardProps) {
  const { sortableData, ...rest } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.item.id,
    disabled: props.alreadyInTarget || props.disableDrag,
    data: sortableData,
  });

  const outerStyle: React.CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    ...(transition ? { transition } : {}),
  };

  return (
    <ItemCardChrome
      {...rest}
      setNodeRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      outerStyle={outerStyle}
      isDragging={isDragging}
    />
  );
}

/**
 * `dragMode="sortable"`: 미분류 풀·티어 행 안에서 순서 변경 및 사이 삽입.
 * 기본값: 오버레이 등 `useDraggable`.
 */
export function ItemCard(
  props: ItemCardProps & { dragMode?: 'draggable' | 'sortable' },
) {
  const { dragMode, ...rest } = props;
  if (dragMode === 'sortable') {
    return <ItemCardSortable {...rest} />;
  }
  return <ItemCardDraggable {...rest} />;
}
