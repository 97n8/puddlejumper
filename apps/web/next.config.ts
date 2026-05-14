import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pj/core", "@pj/ui", "@pj/db"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "publiclogic.org" },
    ],
  },
};

export default nextConfig;
