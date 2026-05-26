import type { NextConfig } from "next";
// 環境変数 BACKEND_URL があればそれを使い、なければローカルの localhost:8080 を使用
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
const nextConfig: NextConfig = {
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