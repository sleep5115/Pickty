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
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/uploads/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8080', pathname: '/uploads/**' },
      { protocol: 'https', hostname: 'api.pickty.app', pathname: '/**' },
      { protocol: 'https', hostname: 'img.pickty.app', pathname: '/**' },
      { protocol: 'https', hostname: '*.r2.dev', pathname: '/**' },
    ],
  },
};

export default nextConfig;
