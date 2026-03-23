'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { TierItem } from '@/lib/store/tier-store';

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

interface ItemCardProps {
  item: TierItem;
  isSelected?: boolean;
  targetingActive?: boolean;
  alreadyInTarget?: boolean;
  /** DragOverlay 내 렌더링 시 drag 훅 비활성화 */
  disableDrag?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ItemCard({
  item,
  isSelected = false,
  targetingActive = false,
  alreadyInTarget = false,
  disableDrag = false,
  onClick,
}: ItemCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: item.id,
      disabled: alreadyInTarget || disableDrag,
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const initials = item.name.slice(0, 2);
  const bgColor = hashColor(item.id);

  return (
    <button
      suppressHydrationWarning
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-item-id={item.id}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={alreadyInTarget}
      title={item.name}
      style={{
        ...style,
        backgroundColor: !item.imageUrl ? bgColor : undefined,
      }}
      className={[
        'relative w-16 h-16 flex items-center justify-center',
        'text-xs font-bold text-white rounded select-none touch-none',
        'border-2 overflow-hidden',
        'transition-[border,box-shadow,opacity,transform] duration-150',
        isDragging
          ? 'opacity-20 cursor-grabbing'
          : alreadyInTarget
            ? 'opacity-40 border-slate-400 dark:border-zinc-600 cursor-not-allowed'
            : 'hover:brightness-110 cursor-grab active:scale-95',
        isSelected
          ? 'border-violet-400 ring-2 ring-violet-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 scale-105'
          : 'border-transparent',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {item.imageUrl ? (
        <img
          src={picktyImageDisplaySrc(item.imageUrl)}
          alt={item.name}
          className="w-full h-full object-cover pointer-events-none"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="text-center leading-tight px-0.5 drop-shadow pointer-events-none">
          {initials}
        </span>
      )}

      {/* 타겟팅 모드 오버레이 */}
      {targetingActive && !alreadyInTarget && (
        <span className="absolute inset-0 bg-violet-400/10 pointer-events-none rounded" />
      )}

      {/* 선택 오버레이 */}
      {isSelected && (
        <span className="absolute inset-0 bg-violet-400/20 pointer-events-none rounded" />
      )}
    </button>
  );
}
