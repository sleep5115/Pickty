'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import type { Tier, TierItem } from '@/lib/store/tier-store';

const PREVIEW_BASE_CAP_PX = 1024 * 1.24;
const PREVIEW_SIZE_SCALE = 0.5;
const PREVIEW_SQUARE_CAP_PX = PREVIEW_BASE_CAP_PX * PREVIEW_SIZE_SCALE;
const SWIPE_PX = 56;
const WHEEL_NAV_COOLDOWN_MS = 280;

function wheelGalleryDirection(e: WheelEvent): -1 | 0 | 1 {
  const { deltaX, deltaY } = e;
  if (deltaX === 0 && deltaY === 0) return 0;
  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    if (deltaY > 0) return 1;
    if (deltaY < 0) return -1;
    return 0;
  }
  if (deltaX > 0) return 1;
  if (deltaX < 0) return -1;
  return 0;
}

function buildResultImageGallery(pool: TierItem[], tiers: Tier[]): TierItem[] {
  const hasImage = (it: TierItem) => Boolean(it.imageUrl?.trim());
  return [...pool.filter(hasImage), ...tiers.flatMap((t) => t.items.filter(hasImage))];
}

export function TierResultImagePreviewModal({
  pool,
  tiers,
  previewItem,
  onClose,
  onPreviewItemChange,
}: {
  pool: TierItem[];
  tiers: Tier[];
  previewItem: TierItem | null;
  onClose: () => void;
  onPreviewItemChange: (item: TierItem | null) => void;
}) {
  const gallery = useMemo(() => buildResultImageGallery(pool, tiers), [pool, tiers]);
  const index = useMemo(() => {
    if (!previewItem) return -1;
    return gallery.findIndex((i) => i.id === previewItem.id);
  }, [gallery, previewItem]);

  const touchStartX = useRef<number | null>(null);
  const previewWheelRef = useRef<HTMLDivElement>(null);
  const lastWheelNavAtRef = useRef(0);

  const stepPreview = (delta: number) => {
    if (gallery.length === 0) {
      onPreviewItemChange(null);
      return;
    }
    let idx = index >= 0 ? index : 0;
    idx = Math.max(0, Math.min(gallery.length - 1, idx + delta));
    onPreviewItemChange(gallery[idx] ?? null);
  };

  useEffect(() => {
    if (!previewItem?.imageUrl) return;
    if (gallery.length === 0) {
      onPreviewItemChange(null);
      return;
    }
    if (!gallery.some((i) => i.id === previewItem.id)) {
      onPreviewItemChange(null);
    }
  }, [gallery, previewItem, onPreviewItemChange]);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepPreview(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepPreview(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewItem, onClose, index, gallery]);

  useEffect(() => {
    if (!previewItem?.imageUrl) return;
    const el = previewWheelRef.current;
    if (!el) return;

    const showNav = gallery.length > 1;
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelNavAtRef.current < WHEEL_NAV_COOLDOWN_MS) {
        e.preventDefault();
        return;
      }

      const dir = wheelGalleryDirection(e);
      if (dir === 0) return;

      e.preventDefault();
      if (!showNav) return;
      lastWheelNavAtRef.current = now;
      stepPreview(dir);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [previewItem?.imageUrl, gallery.length, index, gallery]);

  if (!previewItem?.imageUrl) return null;

  const src = picktyImageDisplaySrc(previewItem.imageUrl);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < gallery.length - 1;
  const showNav = gallery.length > 1;
  const squareStyle = {
    width: `min(${PREVIEW_SQUARE_CAP_PX}px, calc((min(100vw, 100dvh) - 1rem) * ${PREVIEW_SIZE_SCALE}))`,
    height: `min(${PREVIEW_SQUARE_CAP_PX}px, calc((min(100vw, 100dvh) - 1rem) * ${PREVIEW_SIZE_SCALE}))`,
  } as const;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-transparent p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${previewItem.name} 이미지 확대`}
      onClick={onClose}
      onPointerDownCapture={(e) => {
        if (!e.altKey) return;
        e.preventDefault();
        onClose();
      }}
    >
      <div
        className="flex max-w-[100vw] flex-row items-center justify-center gap-1 sm:gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {showNav && (
          <button
            type="button"
            aria-label="이전 이미지"
            disabled={!canPrev}
            className="shrink-0 rounded-full p-2 text-slate-800 dark:text-zinc-100 enabled:hover:bg-black/10 enabled:dark:hover:bg-white/10 disabled:opacity-25 touch-manipulation"
            onClick={() => stepPreview(-1)}
          >
            <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden />
          </button>
        )}
        <div
          ref={previewWheelRef}
          className="relative box-border shrink-0 overflow-hidden rounded-none shadow-none ring-0 outline-none"
          style={squareStyle}
          onTouchStart={(e) => {
            const x = e.changedTouches[0]?.clientX;
            touchStartX.current = x ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current == null || !showNav) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
            const d = endX - touchStartX.current;
            touchStartX.current = null;
            if (d > SWIPE_PX) stepPreview(-1);
            else if (d < -SWIPE_PX) stepPreview(1);
          }}
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute right-0.5 top-0.5 z-10 rounded-full p-1 text-white bg-black/45 hover:bg-black/55 dark:bg-white/25 dark:hover:bg-white/35 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={previewItem.name}
            className="box-border h-full w-full max-w-none object-contain select-none"
            draggable={false}
          />
        </div>
        {showNav && (
          <button
            type="button"
            aria-label="다음 이미지"
            disabled={!canNext}
            className="shrink-0 rounded-full p-2 text-slate-800 dark:text-zinc-100 enabled:hover:bg-black/10 enabled:dark:hover:bg-white/10 disabled:opacity-25 touch-manipulation"
            onClick={() => stepPreview(1)}
          >
            <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
