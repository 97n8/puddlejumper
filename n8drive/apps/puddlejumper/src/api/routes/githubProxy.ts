// ── GitHub API Proxy for LogicOS ──────────────────────────────────────────
//
// Proxies authenticated requests to api.github.com using the GitHub token
// stored in ConnectorStore for the logged-in user.  LogicOS calls these
// endpoints with credentials: 'include'; the JWT session cookie is validated
// here, then the stored token (never exposed to the browser) is used upstream.
//
// Mounted at: /api/github/*
// Auth: requires valid PJ session (JWT cookie or Bearer header)
// CSRF: exempt — cross-origin SPA using cookie auth + CORS credentials

import express from "express";
import { getAuthContext } from "@publiclogic/core";
import type { ConnectorStore } from "../connectorStore.js";

type GitHubProxyOptions = {
  store: ConnectorStore;
  fetchImpl?: typeof fetch;
};

// Headers to forward from GitHub responses to the caller
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "x-ratelimit-used",
  "x-ratelimit-resource",
  "link",
  "etag",
  "last-modified",
];

export function createGitHubProxyRoutes(opts: GitHubProxyOptions): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;

  router.all("/*", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const tenantId = auth.tenantId ?? "";
    if (!tenantId) {
      res.status(400).json({ error: "Tenant scope unavailable" });
      return;
    }

    const tokenRecord = opts.store.getToken("github", tenantId, auth.userId);
    if (!tokenRecord) {
      res
        .status(401)
        .json({ error: "GitHub not connected", code: "GITHUB_NOT_CONNECTED" });
      return;
    }

    // Build upstream URL: strip leading slash, preserve query string
    const upstreamPath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
    const rawQuery = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const upstreamUrl = `https://api.github.com/${upstreamPath}${rawQuery}`;

    const isBodyless = ["GET", "HEAD", "DELETE"].includes(req.method.toUpperCase());

    let body: string | undefined;
    if (!isBodyless && req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
    }

    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: req.method,
        headers: {
          Authorization: `token ${tokenRecord.accessToken}`,
          Accept: req.headers.accept ?? "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "PublicLogic-PuddleJumper",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body,
      });

      // Forward relevant response headers
      for (const header of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(header);
        if (value !== null) {
          res.setHeader(header, value);
        }
      }

      const responseBody = await upstream.text();
      res.status(upstream.status).send(responseBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upstream request failed";
      res.status(502).json({ error: "GitHub API request failed", detail: message });
    }
  });

  return router;
}
