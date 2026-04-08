'use client';

import { ZoomIn } from 'lucide-react';
import { hashColor } from '@/components/tier/item-card';
import { TierItemTileImages } from '@/components/tier/tier-item-tile-images';
import { isTierSpacerId, type TierItem } from '@/lib/store/tier-store';

/** DnD 없이 ItemCard와 동일한 타일 UI (읽기 전용·캡처용) */
export function StaticItemCard({
  item,
  onPreview,
}: {
  item: TierItem;
  onPreview?: (item: TierItem) => void;
}) {
  if (isTierSpacerId(item.id)) {
    return (
      <div
        data-item-id={item.id}
        data-tier-spacer="true"
        className="relative h-16 w-16 shrink-0 hidden sm:block opacity-0"
        aria-hidden
      />
    );
  }

  const initials = item.name.slice(0, 2);
  const bgColor = hashColor(item.id);
  const showPreviewBtn = Boolean(item.imageUrl?.trim()) && Boolean(onPreview);

  return (
    <div
      data-item-id={item.id}
      title={item.name}
      style={{
        backgroundColor: !item.imageUrl ? bgColor : undefined,
      }}
      className={[
        'group relative w-16 h-16 flex items-center justify-center',
        'text-xs font-bold text-white rounded select-none',
        'border-2 border-transparent overflow-hidden',
      ].join(' ')}
      onClick={(e) => {
        if (!onPreview || !item.imageUrl?.trim()) return;
        if ((e.target as HTMLElement).closest('[data-role="preview-btn"]')) return;
        if (!(e.altKey || e.detail > 1)) return;
        e.stopPropagation();
        onPreview(item);
      }}
    >
      {item.imageUrl ? (
        <TierItemTileImages
          imageUrl={item.imageUrl}
          alt={item.name}
          focusRect={item.focusRect}
        />
      ) : (
        <span className="text-center leading-tight px-0.5 drop-shadow pointer-events-none">
          {initials}
        </span>
      )}
      {showPreviewBtn && (
        <button
          type="button"
          data-role="preview-btn"
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
            onPreview?.(item);
          }}
        >
          <ZoomIn className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        </button>
      )}
    </div>
  );
}
