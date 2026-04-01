/**
 * 티어 설정 모달·도화지 표배경 등 공용 색 프리셋 (라벨 배경/글자색과 동일 팔레트).
 */
export const TIER_COLOR_PRESETS = [
  '#FF7F7F',
  '#FFBF7F',
  '#FFDF7F',
  '#BFFF7F',
  '#7FFF7F',
  '#7FFFFF',
  '#7FBFFF',
  '#BF7FFF',
  '#FF7FBF',
  '#FF4444',
  '#FFAA00',
  '#44DD44',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#FFFFFF',
  '#f9fafb',
  '#AAAAAA',
  '#555555',
  '#111827',
  '#000000',
] as const;

export type TierColorPreset = (typeof TIER_COLOR_PRESETS)[number];
