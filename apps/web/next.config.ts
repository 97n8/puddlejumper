import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@publiclogic/core', '@pj/ui'],
};

export default nextConfig;
