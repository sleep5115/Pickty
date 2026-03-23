import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 로컬·LAN·운영 도메인에서 Next dev HMR 허용(필요 시 env에 맞게 조정)
  allowedDevOrigins: [
    '192.168.219.100',
    'localhost',
    '127.0.0.1',
    'pickty.app',
    'www.pickty.app',
  ],
  images: {
    /** 로컬에서 `/_next/image?url=http://localhost:8080/...` 허용 — 기본 false면 루프백·사설 IP 페치가 400 */
    dangerouslyAllowLocalIP: true,
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
