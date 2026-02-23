// ── Google API Proxy ──────────────────────────────────────────────────────
//
// Proxies authenticated requests to googleapis.com using the Google token
// stored in ConnectorStore for the logged-in user. Auto-refreshes expired tokens.
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

async function refreshGoogleToken(
  store: ConnectorStore,
  fetchImpl: typeof fetch,
  tenantId: string,
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });
    const res = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) return null;
    const payload = await res.json() as Record<string, unknown>;
    const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
    if (!accessToken) return null;
    const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
    store.upsertToken({
      provider: "google",
      tenantId,
      userId,
      accessToken,
      refreshToken,
      scopes: [],
      account: null,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
    return accessToken;
  } catch {
    return null;
  }
}

export function createGoogleProxyRoutes(opts: GoogleProxyOptions): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

  router.all("/*", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const userId = auth.userId ?? auth.sub;
    let tokenRecord = opts.store.getToken("google", tenantId, userId);
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

    const makeRequest = (accessToken: string) =>
      fetchImpl(upstreamUrl, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: req.headers.accept ?? "application/json",
          "User-Agent": "PublicLogic-PuddleJumper",
          ...(contentTypeOverride ? { "Content-Type": contentTypeOverride } : {}),
        },
        body,
      });

    try {
      let upstream = await makeRequest(tokenRecord.accessToken);

      // Auto-refresh on 401 if we have a refresh token
      if (upstream.status === 401 && tokenRecord.refreshToken && clientId && clientSecret) {
        const newToken = await refreshGoogleToken(
          opts.store, fetchImpl, tenantId, userId,
          tokenRecord.refreshToken, clientId, clientSecret
        );
        if (newToken) {
          upstream = await makeRequest(newToken);
        }
      }

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
