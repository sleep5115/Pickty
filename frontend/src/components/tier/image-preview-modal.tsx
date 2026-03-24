'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import {
  buildTierImageGallery,
  useTierStore,
} from '@/lib/store/tier-store';

/**
 * 업로드본은 장변 1024로 압축. (1024×1.24)px 상한 정사각형의 0.5배 변.
 * 테두리·그림자 없음 — 이미지 파일에 테두리가 있으면 그건 데이터.
 */
const PREVIEW_BASE_CAP_PX = 1024 * 1.24;
const PREVIEW_SIZE_SCALE = 0.5;
const PREVIEW_SQUARE_CAP_PX = PREVIEW_BASE_CAP_PX * PREVIEW_SIZE_SCALE;

const SWIPE_PX = 56;

/**
 * 바깥 클릭 닫힘. Alt+PointerDown 아무 곳이나 닫힘(연속 Alt+클릭 탐색).
 * 풀 → 티어 행 순 이미지 갤러리: 이전·다음 버튼, 좌우 방향키, 모바일 스와이프.
 */
export function ImagePreviewModal() {
  const pool = useTierStore((s) => s.pool);
  const tiers = useTierStore((s) => s.tiers);
  const previewItem = useTierStore((s) => s.previewItem);
  const setPreviewItem = useTierStore((s) => s.setPreviewItem);
  const stepImagePreview = useTierStore((s) => s.stepImagePreview);

  const gallery = useMemo(
    () => buildTierImageGallery({ pool, tiers }),
    [pool, tiers],
  );

  const index = useMemo(() => {
    if (!previewItem) return -1;
    return gallery.findIndex((i) => i.id === previewItem.id);
  }, [gallery, previewItem]);

  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!previewItem?.imageUrl) return;
    if (gallery.length === 0) {
      setPreviewItem(null);
      return;
    }
    if (!gallery.some((i) => i.id === previewItem.id)) {
      setPreviewItem(null);
    }
  }, [gallery, previewItem, setPreviewItem]);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewItem(null);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepImagePreview(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepImagePreview(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewItem, setPreviewItem, stepImagePreview]);

  if (!previewItem?.imageUrl) {
    return null;
  }

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
      onClick={() => setPreviewItem(null)}
      onPointerDownCapture={(e) => {
        if (!e.altKey) return;
        e.preventDefault();
        setPreviewItem(null);
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
            onClick={() => stepImagePreview(-1)}
          >
            <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden />
          </button>
        )}

        <div
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
            if (d > SWIPE_PX) stepImagePreview(-1);
            else if (d < -SWIPE_PX) stepImagePreview(1);
          }}
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute right-0.5 top-0.5 z-10 rounded-full p-1 text-white bg-black/45 hover:bg-black/55 dark:bg-white/25 dark:hover:bg-white/35 touch-manipulation"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewItem(null);
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
            onClick={() => stepImagePreview(1)}
          >
            <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
