import type { CSSProperties } from 'react';
import type { Tier } from '@/lib/store/tier-store';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

export function tierHasBackgroundImage(tier: Tier): boolean {
  return Boolean(tier.backgroundUrl?.trim());
}

/** 라벨 셀 배경 — `picktyImageDisplaySrc` 경유로 html-to-image CORS 회피 */
export function getTierLabelSurfaceStyle(tier: Tier): CSSProperties {
  const raw = tier.backgroundUrl?.trim();
  if (raw) {
    const src = picktyImageDisplaySrc(raw);
    return {
      backgroundImage: `url("${src}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  return { backgroundColor: tier.color };
}

export function getTierLabelTextStyle(tier: Tier): CSSProperties | undefined {
  if (!tierHasBackgroundImage(tier)) return undefined;
  return {
    color: '#ffffff',
    textShadow: '0 0 4px rgba(0,0,0,0.8)',
  };
}
