import type { NextConfig } from "next";

// CSP is now applied per-request via src/proxy.ts with nonces.
// Only non-CSP security headers remain here.

const nextConfig: NextConfig = {
  output: "standalone",
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
