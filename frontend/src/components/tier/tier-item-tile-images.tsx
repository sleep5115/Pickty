import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

type TierItemTileImagesProps = {
  imageUrl: string;
  alt: string;
};

/**
 * 정사각형 타일 안에서 세로·가로 풀 일러스트가 잘리지 않게 `object-contain` 만 사용.
 * (블러 배경 레이어는 시각적 잡음·확대 모달과 어울리지 않아 제거함.)
 */
export function TierItemTileImages({ imageUrl, alt }: TierItemTileImagesProps) {
  const src = picktyImageDisplaySrc(imageUrl);
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
