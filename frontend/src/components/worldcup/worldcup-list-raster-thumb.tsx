'use client';

import { useEffect, useState } from 'react';
import { parseYoutubeVideoId } from '@/lib/worldcup/worldcup-media-url';
import {
  freezeRasterImageUrlToJpegDataUrl,
  isLikelyAnimatedGifRasterUrl,
} from '@/lib/worldcup/worldcup-raster-static';
import { worldCupMediaListThumbnailSrc } from '@/components/worldcup/worldcup-url-media';

type Props = {
  rawUrl: string;
  alt: string;
  className?: string;
};

/** GIF만 — 마운트 후 비동기로 첫 프레임 JPEG; 실패 시 `thumbFallback` 표시 */
function WorldCupListFrozenGifThumb({
  rawUrl,
  thumbFallback,
  alt,
  className,
}: {
  rawUrl: string;
  thumbFallback: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void freezeRasterImageUrlToJpegDataUrl(rawUrl, 320).then(
      (frozen) => {
        if (!cancelled) setSrc(frozen);
      },
      () => {
        if (!cancelled) setSrc(thumbFallback);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [rawUrl, thumbFallback]);

  if (src === null) {
    return (
      <div
        className={['animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className].filter(Boolean).join(' ')}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} draggable={false} />
  );
}

/**
 * 랭킹 행 등 — 유튜브는 정적 썸네일, GIF는 첫 프레임 JPEG로 고정(목록에서만 사용).
 */
export function WorldCupListRasterThumb({ rawUrl, alt, className }: Props) {
  const t = rawUrl.trim();
  if (!t) {
    return null;
  }

  if (parseYoutubeVideoId(t)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={worldCupMediaListThumbnailSrc(t)} alt={alt} className={className} draggable={false} />
    );
  }

  const thumb = worldCupMediaListThumbnailSrc(t);
  const needFreeze = isLikelyAnimatedGifRasterUrl(t) || isLikelyAnimatedGifRasterUrl(thumb);
  if (!needFreeze) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumb} alt={alt} className={className} draggable={false} />
    );
  }

  return (
    <WorldCupListFrozenGifThumb
      key={t}
      rawUrl={t}
      thumbFallback={thumb}
      alt={alt}
      className={className}
    />
  );
}
