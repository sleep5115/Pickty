'use client';

import { useEffect } from 'react';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

/** 인증샷·현실피드 사진을 원본 크기로 대조해 보는 라이트박스. */
export function ImageLightbox({
  imageUrl,
  caption,
  onClose,
}: {
  imageUrl: string;
  caption?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-4 backdrop-blur-sm"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={picktyImageDisplaySrc(imageUrl)}
        alt={caption ?? '이미지'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
      />
      {caption ? <p className="max-w-2xl text-center text-sm text-white/90">{caption}</p> : null}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg text-white transition hover:bg-white/25"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
