// ── Microsoft Graph API Proxy ─────────────────────────────────────────────
//
// Proxies authenticated requests to graph.microsoft.com/v1.0 using the
// Microsoft token stored in ConnectorStore for the logged-in user.
//
// Mounted at: /api/microsoft/*
// Auth: requires valid PJ session (JWT cookie or Bearer header)

import express from "express";
import { getAuthContext } from "@publiclogic/core";
import type { ConnectorStore } from "../connectorStore.js";

type MicrosoftProxyOptions = {
  store: ConnectorStore;
  fetchImpl?: typeof fetch;
};

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "odata-version",
  "request-id",
  "client-request-id",
  "etag",
  "link",
];

export function createMicrosoftProxyRoutes(opts: MicrosoftProxyOptions): express.Router {
  const router = express.Router();
  const fetchImpl = opts.fetchImpl ?? fetch;

  router.all("/*", async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

    const tenantId = auth.tenantId ?? "";
    if (!tenantId) { res.status(400).json({ error: "Tenant scope unavailable" }); return; }

    const tokenRecord = opts.store.getToken("microsoft", tenantId, auth.userId ?? auth.sub);
    if (!tokenRecord) {
      res.status(401).json({ error: "Microsoft not connected", code: "MICROSOFT_NOT_CONNECTED" });
      return;
    }

    const upstreamPath = req.path.startsWith("/") ? req.path.slice(1) : req.path;
    const rawQuery = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    const upstreamUrl = `https://graph.microsoft.com/v1.0/${upstreamPath}${rawQuery}`;

    const isBodyless = ["GET", "HEAD"].includes(req.method.toUpperCase());
    let body: string | undefined;
    if (!isBodyless && req.body !== undefined && req.body !== null) {
      body = JSON.stringify(req.body);
    }

    try {
      const upstream = await fetchImpl(upstreamUrl, {
        method: req.method,
        headers: {
          Authorization: `Bearer ${tokenRecord.accessToken}`,
          Accept: req.headers.accept ?? "application/json",
          "User-Agent": "PublicLogic-PuddleJumper",
          ...(body ? { "Content-Type": "application/json" } : {}),
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
      res.status(502).json({ error: "Microsoft Graph request failed", detail: message });
    }
  });

  return router;
}
