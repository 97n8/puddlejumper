// ── Google API Proxy ──────────────────────────────────────────────────────
//
// Proxies authenticated requests to googleapis.com using the Google token
// stored in ConnectorStore for the logged-in user.
//
// Mounted at: /api/google/*
// Auth: requires valid PJ session (JWT cookie or Bearer header)

import express from "express";
import { getAuthContext } from "@publiclogic/core";
import type { ConnectorStore } from "../connectorStore.js";

type GoogleProxyOptions = {
  store: ConnectorStore;
  fetchImpl?: typeof fetch;
};

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "etag",
  "link",
  "x-goog-request-id",
];

export function createGoogleProxyRoutes(opts: GoogleProxyOptions): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;

  router.all("/*", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const tokenRecord = opts.store.getToken("google", tenantId, auth.userId ?? auth.sub);
    if (!tokenRecord) {
      res.status(401).json({ error: "Google not connected", code: "GOOGLE_NOT_CONNECTED" });
      return;
    }

    const upstreamPath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
    const rawQuery = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";

    // Google multipart/resumable uploads use upload.googleapis.com
    const isUpload = upstreamPath.startsWith("upload/");
    const baseUrl = isUpload ? "https://upload.googleapis.com" : "https://www.googleapis.com";
    const upstreamUrl = `${baseUrl}/${upstreamPath}${rawQuery}`;

    const isBodyless = ["GET", "HEAD"].includes(req.method.toUpperCase());
    let body: BodyInit | undefined;
    let contentTypeOverride: string | undefined;

    if (!isBodyless) {
      const rawContentType = req.headers["content-type"] ?? "";
      if (rawContentType.startsWith("multipart/")) {
        const raw = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
        body = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
        contentTypeOverride = rawContentType;
      } else if (req.body !== undefined && req.body !== null) {
        body = JSON.stringify(req.body);
        contentTypeOverride = "application/json";
      }
    }

    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${tokenRecord.accessToken}`,
          Accept: req.headers.accept ?? "application/json",
          "User-Agent": "PublicLogic-PuddleJumper",
          ...(contentTypeOverride ? { "Content-Type": contentTypeOverride } : {}),
        },
        body,
      });

      for (const header of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(header);
        if (value !== null) res.setHeader(header, value);
      }

      const responseBody = await upstream.text();
      res.status(upstream.status).send(responseBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upstream request failed";
      res.status(502).json({ error: "Google API request failed", detail: message });
    }
  });

  return router;
}
