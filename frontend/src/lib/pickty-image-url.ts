import type { Tier, TierItem } from '@/lib/store/tier-store';

/** 빈 문자열 env는 `??`로 걸러지지 않음 — api-fetch와 동일 규칙 */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:8080';

function apiOrigin(): string {
  const base = API_URL.replace(/\/$/, '');
  return new URL(base.endsWith('/') ? base : `${base}/`).origin;
}

/**
 * DB에 예전 호스트(ngrok, LAN IP 등)로 박힌 Pickty 업로드 URL을 현재 API 오리진으로 맞춤.
 * `/uploads/`만 처리 — 외부 이미지(imgur 등)는 그대로 둠.
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
 * 경로가 `/uploads/`인 Pickty 호스팅 이미지면 true (호스트는 무관 — resolve 전 판별용).
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
  return abs.pathname.startsWith('/uploads/');
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
