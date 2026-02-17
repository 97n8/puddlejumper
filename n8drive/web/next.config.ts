import type { NextConfig } from "next";

// CSP is now applied per-request via src/proxy.ts with nonces.
// Only non-CSP security headers remain here.

const BACKEND_URL =
  process.env.BACKEND_URL || "https://publiclogic-puddlejumper.fly.dev";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy all /api/* requests to the Fly.io backend so that OAuth
      // callbacks, cookies, and session endpoints share the frontend
      // origin (no cross-domain cookie issues).
      // Next.js API routes (e.g. /api/webhook) take precedence over
      // rewrites, so they are unaffected.
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Backend serves /health and /metrics without /api prefix
      { source: "/health", destination: `${BACKEND_URL}/health` },
    ];
  },
  async redirects() {
    return [
      // Legacy backend route — redirect to the frontend home page
      { source: "/pj/admin", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
