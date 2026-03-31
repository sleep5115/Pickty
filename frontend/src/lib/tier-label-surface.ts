import type { CSSProperties } from 'react';
import type { Tier } from '@/lib/store/tier-store';
import type { TemplateBoardSurface } from '@/lib/template-board-config';
import { picktyImageDisplaySrc } from '@/lib/pickty-image-url';

const HEX6 = /^#[0-9A-Fa-f]{6}$/;

export function tierHasBackgroundImage(tier: Tier): boolean {
  return Boolean(tier.backgroundUrl?.trim());
}

/**
 * 라벨 이미지가 없을 때 모달 적용으로 `paintLabelColorUnderImage: false`만 저장된 상태.
 * 이후 첫 라벨 이미지를 올리면 그 false가 남아 누끼 투명 구간에 표 배경만 비치므로,
 * 첫 업로드 시 기본(매트 켬)으로 되돌린다.
 */
export function shouldResetPaintMatWhenAddingFirstLabelImage(tier: Tier): boolean {
  return (
    tier.showLabelColor !== false &&
    tier.paintLabelColorUnderImage === false &&
    !tierHasBackgroundImage(tier)
  );
}

function parseHex6(hex: string): { r: number; g: number; b: number } | null {
  const t = hex.trim();
  if (!HEX6.test(t)) return null;
  const n = parseInt(t.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 단색 배경 위 가독성용 대비 텍스트 색 */
export function contrastTextForHex(bgHex: string): string {
  const rgb = parseHex6(bgHex);
  if (!rgb) return '#111827';
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  return L > 0.55 ? '#111827' : '#f9fafb';
}

/** 표 전체 배경 — 라벨 칸 맨 아래(z-0) 레이어용 */
export function buildWorkspaceBoardSurfaceStyle(
  surface: TemplateBoardSurface | null | undefined,
): CSSProperties {
  const s: CSSProperties = {};
  const bc = surface?.backgroundColor?.trim();
  const bu = surface?.backgroundUrl?.trim();
  if (bc) s.backgroundColor = bc;
  if (bu) {
    s.backgroundImage = `url("${picktyImageDisplaySrc(bu)}")`;
    s.backgroundSize = 'cover';
    s.backgroundPosition = 'center';
    s.backgroundRepeat = 'no-repeat';
  }
  return s;
}

export function workspaceBoardSurfaceIsVisual(
  surface: TemplateBoardSurface | null | undefined,
): boolean {
  return Boolean(surface?.backgroundColor?.trim() || surface?.backgroundUrl?.trim());
}

/** 행 배경 이미지가 없을 때 라벨 칸 단색 — `showLabelColor === false`면 투명(표 배경만) */
export function getTierLabelSolidCellStyle(tier: Tier): CSSProperties {
  if (tier.showLabelColor === false) return {};
  return { backgroundColor: tier.color };
}

/**
 * 라벨 글자 스타일 — `textColor`가 있으면 우선, 없으면 이미지/단색에 맞는 기본 대비.
 */
export function getTierLabelTextStyle(tier: Tier): CSSProperties {
  const tc = tier.textColor?.trim();
  if (tc && HEX6.test(tc)) {
    return { color: tc };
  }
  if (tierHasBackgroundImage(tier)) {
    return {
      color: '#ffffff',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    };
  }
  if (tier.showLabelColor === false) {
    return {
      color: '#ffffff',
      textShadow: '0 0 4px rgba(0,0,0,0.8)',
    };
  }
  return { color: contrastTextForHex(tier.color) };
}
