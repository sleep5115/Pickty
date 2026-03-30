import type { NextConfig } from "next";

const devLanOrigin = process.env.NEXT_DEV_ALLOWED_ORIGIN?.trim();

const nextConfig: NextConfig = {
  // 로컬·LAN·운영 도메인에서 Next dev HMR 허용 — LAN IP는 `.env.local` 의 NEXT_DEV_ALLOWED_ORIGIN (레포에 실 IP 금지)
  allowedDevOrigins: [
    ...(devLanOrigin ? [devLanOrigin] : []),
    'localhost',
    '127.0.0.1',
    'pickty.app',
    'www.pickty.app',
  ],
  images: {
    /** 로컬에서 `/_next/image?url=http://localhost:8080/...` 허용 — 기본 false면 루프백·사설 IP 페치가 400 */
    dangerouslyAllowLocalIP: true,
    /** 원격 `/_next/image` 최소 캐시(초). R2/img·API 프록시 URL은 키 불변 전제로 1년 — Vercel 엣지 재최적화 감소 */
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/uploads/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8080', pathname: '/uploads/**' },
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/api/v1/images/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8080', pathname: '/api/v1/images/**' },
      { protocol: 'https', hostname: 'api.pickty.app', pathname: '/**' },
      { protocol: 'https', hostname: 'img.pickty.app', pathname: '/**' },
      { protocol: 'https', hostname: '*.r2.dev', pathname: '/**' },
    ],
  },
};

export default nextConfig;
