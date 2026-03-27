import type { Tier, TierItem } from '@/lib/store/tier-store';
import { isPicktyHostedImageHostname, PUBLIC_API_BASE_URL } from '@/lib/public-site-config';

const API_URL = PUBLIC_API_BASE_URL;

/** 백엔드 R2ImageStorageService.storedObjectKeyRegex 와 동기화 */
export const PICKTY_STORED_IMAGE_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp|gif|bin)$/i;

/**
 * URL에서 R2에 저장된 객체 키(UUID.확장자)만 추출. 매칭되면 소문자 키, 아니면 null.
 */
export function tryExtractPicktyStoredImageKeyFromResolvedUrl(abs: URL): string | null {
  const path = abs.pathname;
  let key: string | null = null;
  if (path === '/api/v1/images/file') {
    key = new URLSearchParams(abs.search).get('key');
  } else if (path.startsWith('/api/v1/images/file/')) {
    const segs = path.slice('/api/v1/images/file/'.length).split('/').filter(Boolean);
    key = segs.length > 0 ? decodeURIComponent(segs[segs.length - 1]!) : null;
  } else if (isPicktyHostedImageHostname(abs.hostname)) {
    const segments = path.split('/').filter(Boolean);
    key = segments.length > 0 ? decodeURIComponent(segments[segments.length - 1]!) : null;
  }
  if (!key || key.includes('..')) return null;
  const k = key.trim().toLowerCase();
  return PICKTY_STORED_IMAGE_KEY_RE.test(k) ? k : null;
}

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
 * 링크 미리보기(카카오·슬랙·X 등) 크롤러용 `og:image` 절대 URL.
 * `img.pickty.app` 직링크는 봇 요청에서 403이 나는 경우가 많아, Pickty R2 객체(`uuid.ext`)는
 * 공개 **`GET /api/v1/images/file/{key}`** 로 바꿔 넣는다.
 */
export function resolvePicktyImageUrlForOpenGraph(imageUrl: string | null | undefined): string | null {
  if (imageUrl == null) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;
  const resolved = resolvePicktyUploadsUrl(trimmed);
  let abs: URL;
  try {
    abs = new URL(resolved);
  } catch {
    try {
      const path = resolved.startsWith('/') ? resolved : `/${resolved}`;
      abs = new URL(path, `${apiOrigin()}/`);
    } catch {
      return null;
    }
  }
  const key = tryExtractPicktyStoredImageKeyFromResolvedUrl(abs);
  if (key) {
    const base = API_URL.replace(/\/$/, '');
    return `${base}/api/v1/images/file/${encodeURIComponent(key)}`;
  }
  if (abs.protocol === 'https:') {
    return abs.toString();
  }
  return null;
}

/**
 * 화면 표시용 (`<img src>`).
 * - `img.pickty.app` 등을 브라우저가 **직접** 열면 `Referer: http://localhost:3002` 때문에 Cloudflare **403** · **ORB** 가 날 수 있음.
 * - R2 객체 키(`uuid.ext`)는 **동일 출처** `/api/pickty-image?key=` 로만 노출(Next 서버가 img 또는 백엔드 `file?key=` 로 받아 전달).
 */
export function picktyImageDisplaySrc(imageUrl: string): string {
  const resolved = resolvePicktyUploadsUrl(imageUrl);
  let abs: URL;
  try {
    abs = new URL(resolved);
  } catch {
    try {
      const path = resolved.startsWith('/') ? resolved : `/${resolved}`;
      abs = new URL(path, `${apiOrigin()}/`);
    } catch {
      return resolved;
    }
  }

  const key = tryExtractPicktyStoredImageKeyFromResolvedUrl(abs);
  if (key) {
    return `/api/pickty-image?key=${encodeURIComponent(key)}`;
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

function rewriteTierRowUploadUrls(tier: Tier): Tier {
  const items = rewriteTierItemsUploadUrls(tier.items);
  const rawBg = tier.backgroundUrl?.trim();
  let backgroundUrl = tier.backgroundUrl;
  if (rawBg) {
    const resolved = resolvePicktyUploadsUrl(rawBg);
    if (resolved !== rawBg) backgroundUrl = resolved;
  }
  if (items === tier.items && backgroundUrl === tier.backgroundUrl) return tier;
  return { ...tier, items, backgroundUrl };
}

export function rewriteTiersUploadUrls(tiers: Tier[]): Tier[] {
  return tiers.map(rewriteTierRowUploadUrls);
}
