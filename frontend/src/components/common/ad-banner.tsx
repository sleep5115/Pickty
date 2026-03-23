interface AdBannerProps {
  /** 배너 높이 (px). 기본값 90 */
  height?: number;
  className?: string;
}

/** 광고 연동 전까지 미사용. 티어 페이지 등에서 필요 시 import 후 배치. */
export function AdBanner({ height = 90, className = '' }: AdBannerProps) {
  return (
    <div
      className={[
        'w-full shrink-0',
        'bg-zinc-800/50 border border-dashed border-zinc-700/60',
        'rounded-md flex items-center justify-center',
        'text-xs text-zinc-600 select-none',
        className,
      ].join(' ')}
      style={{ height }}
      aria-hidden="true"
    >
      광고 배너 영역
    </div>
  );
}
