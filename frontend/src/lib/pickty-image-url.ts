import type { Tier, TierItem } from '@/lib/store/tier-store';
import { isPicktyHostedImageHostname, PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

const API_URL = PUBLIC_API_BASE_URL;
const API_BASE_TRIMMED = API_URL.replace(/\/$/, '');
/** R2 공개 URL이 403이어도 API가 자격 증명으로 GetObject — 표시용만. DB/스냅샷에는 `https://img.pickty.app/…` 절대 URL 유지. */
const API_IMAGE_FILE_BASE = `${API_BASE_TRIMMED}/api/v1/images/file`;

function apiOrigin(): string {
  const base = API_URL.replace(/\/$/, '');
  return new URL(base.endsWith('/') ? base : `${base}/`).origin;
}

/**
 * DB에 예전 호스트(ngrok, LAN IP 등)로 박힌 Pickty 업로드 URL을 현재 API 오리진으로 맞춤.
 * 레거시 `/uploads/`(로컬 백엔드 정적 서빙)만 처리 — R2(`img.pickty.app`·`*.r2.dev`)·외부(imgur 등)는 그대로 둠.
 */
export function resolvePicktyUploadsUrl(imageUrl: string): string {
  const base = API_URL.replace(/\/$/, '');
  let abs: URL;
  try {
    abs = new URL(imageUrl);
  } catch {
    try {
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      abs = new URL(path, `${base}/`);
    } catch {
      return imageUrl;
    }
  }
  if (!abs.pathname.startsWith('/uploads/')) {
    return imageUrl;
  }
  const origin = apiOrigin();
  if (abs.origin === origin) {
    return imageUrl;
  }
  return `${origin}${abs.pathname}${abs.search}${abs.hash}`;
}

/**
 * 화면 표시용 URL. `img.pickty.app` 객체는 `GET /api/v1/images/file/{key}` 로 제공(백엔드가 R2에서 읽음).
 * 로컬 dev는 `NEXT_PUBLIC_API_URL` 이 `http://127.0.0.1:8080` 일 때 그 오리진으로 요청됨.
 */
export function picktyImageDisplaySrc(imageUrl: string): string {
  const resolved = resolvePicktyUploadsUrl(imageUrl);
  let abs: URL;
  try {
    abs = new URL(resolved);
  } catch {
    try {
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      abs = new URL(path, `${apiOrigin()}/`);
    } catch {
      return resolved;
    }
  }
  if (abs.hostname.toLowerCase() === 'img.pickty.app') {
    const key = decodeURIComponent(abs.pathname.replace(/^\//, ''));
    if (!key || key.includes('/') || key.includes('..')) {
      return resolved;
    }
    return `${API_IMAGE_FILE_BASE}/${encodeURIComponent(key)}`;
  }
  return resolved;
}

/**
 * Pickty가 제공하는 이미지 자산(레거시 `/uploads/` 또는 R2 공개 URL)이면 true.
 * html-to-image 등에서 `crossOrigin="anonymous"` 필요 여부 판별용.
 */
export function isPicktyUploadsAssetUrl(imageUrl: string): boolean {
  const base = API_URL.replace(/\/$/, '');
  let abs: URL;
  try {
    abs = new URL(imageUrl);
  } catch {
    try {
      const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
      abs = new URL(path, `${base}/`);
    } catch {
      return false;
    }
  }
  if (abs.pathname.startsWith('/uploads/')) {
    return true;
  }
  return isPicktyHostedImageHostname(abs.hostname);
}

export function rewriteTierItemUploadUrl(item: TierItem): TierItem {
  if (!item.imageUrl) return item;
  const next = resolvePicktyUploadsUrl(item.imageUrl);
  return next === item.imageUrl ? item : { ...item, imageUrl: next };
}

export function rewriteTierItemsUploadUrls(items: TierItem[]): TierItem[] {
  return items.map(rewriteTierItemUploadUrl);
}

export function rewriteTiersUploadUrls(tiers: Tier[]): Tier[] {
  return tiers.map((row) => ({
    ...row,
    items: rewriteTierItemsUploadUrls(row.items),
  }));
}
