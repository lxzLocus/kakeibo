import type { NextConfig } from "next";
// 環境変数 BACKEND_URL があればそれを使い、なければローカルの localhost:8080 を使用
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
const nextConfig: NextConfig = {
  // LAN内のスマホ等（別オリジン）から dev サーバーにアクセスする際の許可（このPCのLAN IP）
  allowedDevOrigins: ['192.168.1.50'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};
export default nextConfig;