import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

type TierItemTileImagesProps = {
  imageUrl: string;
  alt: string;
  focusRect?: { x: number; y: number; w: number; h: number };
};

/**
 * 정사각형 타일 안에서 세로·가로 풀 일러스트가 잘리지 않게 `object-contain` 만 사용.
 * focusRect가 있으면 해당 영역이 꽉 차게 줌인(Crop) 함.
 */
export function TierItemTileImages({ imageUrl, alt, focusRect }: TierItemTileImagesProps) {
  const src = picktyImageDisplaySrc(imageUrl);

  if (focusRect && focusRect.w > 0 && focusRect.h > 0) {
    const { x, y, w, h } = focusRect;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="pointer-events-none absolute"
        style={{
          width: `${100 / w}%`,
          height: `${100 / h}%`,
          left: `${-x * (100 / w)}%`,
          top: `${-y * (100 / h)}%`,
          objectFit: 'cover',
        }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 티어 타일 동적 URL
    <img
      src={src}
      alt={alt}
      className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      loading="lazy"
      decoding="async"
    />
  );
}
