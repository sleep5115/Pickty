'use client';

import type { Tier } from '@/lib/store/tier-store';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';
import { getTierLabelSolidCellStyle, getTierLabelTextStyle, tierHasBackgroundImage } from '@/lib/tier-label-surface';

type TierLabelCellViewProps = {
  tier: Tier;
  textClassName?: string;
  /** 모달 썸네일 등 고정 작은 박스 */
  compact?: boolean;
};

/**
 * 라벨 칸만 담당. 표 전체 배경은 부모 한 겹.
 * 스택(아래→위): 표 배경(부모) → 라벨 배경색 → 라벨 이미지 → 글자
 * `showLabelColor === false`면 단색·누끼 아래 매트 없음(표 배경만).
 * 이미지가 있을 때 매트는 `showLabelColor`가 켜진 경우에만 `paintLabelColorUnderImage`로 제어.
 */
export function TierLabelCellView({
  tier,
  textClassName = 'text-2xl font-black select-none',
  compact = false,
}: TierLabelCellViewProps) {
  const hasImg = tierHasBackgroundImage(tier);
  const textStyle = getTierLabelTextStyle(tier);
  /** compact: 모달 스와치 등 고정 박스. 그 외: 티어 행에서 아이템 줄바꿈 시 라벨 배경이 행 전체 높이를 채우도록 flex-1 */
  const box = compact ? 'h-full w-full min-h-0' : 'min-h-20 w-full min-h-0 flex-1';

  if (!hasImg) {
    return (
      <span
        className={`flex ${box} items-center justify-center ${textClassName}`}
        style={{ ...getTierLabelSolidCellStyle(tier), ...textStyle }}
      >
        {tier.label}
      </span>
    );
  }

  const showFill = tier.showLabelColor !== false;
  const paintLabelColor = showFill && tier.paintLabelColorUnderImage !== false;
  const src = picktyImageDisplaySrc(tier.backgroundUrl!.trim());

  return (
    <span className={`relative flex ${box} items-center justify-center overflow-hidden`}>
      {paintLabelColor ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{ backgroundColor: tier.color }}
        />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <span className={`relative z-[2] ${textClassName}`} style={textStyle}>
        {tier.label}
      </span>
    </span>
  );
}
