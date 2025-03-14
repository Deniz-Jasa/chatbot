import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: 'quilled-sky-f24.notion.site',
      },
    ],
  },
};

export default nextConfig;
