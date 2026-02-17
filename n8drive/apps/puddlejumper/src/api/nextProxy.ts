import { createProxyMiddleware } from "http-proxy-middleware";
import type { RequestHandler } from "express";

/**
 * Proxy middleware for forwarding requests to Next.js standalone server.
 * Next.js runs on internal port 3003, Express proxies frontend routes to it.
 *
 * This middleware should be mounted LAST (after all API routes) so that:
 * - Express handles /api/*, /health, /metrics directly
 * - Everything else (/, /admin, /vault, etc.) goes to Next.js
 */
export function createNextProxyMiddleware(): RequestHandler {
  const NEXTJS_URL = process.env.NEXTJS_URL || "http://localhost:3003";

  return createProxyMiddleware({
    target: NEXTJS_URL,
    changeOrigin: true,
    ws: true, // Proxy websockets (for Next.js dev HMR, not used in prod but harmless)
    logLevel: process.env.NODE_ENV === "production" ? "warn" : "info",
    onError: (err, req, res) => {
      console.error(`[Next.js Proxy Error] ${req.method} ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Next.js server unavailable",
          details: process.env.NODE_ENV === "production" ? undefined : err.message,
        });
      }
    },
  });
}
