import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 같은 LAN IP에서 모바일로 접속해 개발할 때 HMR(핫리로드) 허용
  allowedDevOrigins: ['192.168.219.100'],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '8080', pathname: '/uploads/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '8080', pathname: '/uploads/**' },
    ],
  },
};

export default nextConfig;
