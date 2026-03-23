/**
 * 운영 기본값은 백엔드·Vercel·pickty-config 와 맞출 것.
 *
 * | 항목 | 프론트(여기) | 백엔드 application-secrets.yaml |
 * |------|----------------|-----------------------------------|
 * | API 베이스 | NEXT_PUBLIC_API_URL → https://api.pickty.app | (브라우저가 호출하는 호스트와 동일해야 Mixed Content 없음) |
 * | 사이트 오리진 | NEXT_PUBLIC_SITE_URL → https://pickty.app | FRONTEND_URL: https://pickty.app |
 * | CORS·OAuth 리다이렉트 화이트리스트 | 위 사이트 + localhost:3002 | app.oauth2.allowed-frontend-origins 동일 목록 |
 * | 업로드 이미지 공개 URL | img.pickty.app (hostname 판별 + next/image) | cloud.cloudflare.r2.public-url: https://img.pickty.app |
 *
 * 빈 문자열 env는 `??`로 걸러지지 않음 — trim 후 fallback
 */
export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.trim() || 'https://api.pickty.app';

export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://pickty.app';

const EXTRA_IMAGE_HOSTS =
  process.env.NEXT_PUBLIC_PICKTY_IMAGE_HOSTS?.split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) ?? [];

/** R2 커스텀 도메인 + 레거시 r2.dev + env 확장 */
export function isPicktyHostedImageHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'img.pickty.app') return true;
  if (h.endsWith('.r2.dev')) return true;
  return EXTRA_IMAGE_HOSTS.includes(h);
}
