// ── User Preferences Routes ──────────────────────────────────────────────────
//
// Per-user key-value store backed by SQLite users.db. Used by LogicOS to
// persist UI state (active tool, appearance, dismissals, etc.) across
// browsers and devices.
//
// Routes:
//   GET  /api/prefs         — return all prefs for current user
//   PUT  /api/prefs/:key    — set/update a pref (body: { value: any })
//   DELETE /api/prefs/:key  — remove a pref

import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getAllPrefs, setPref, deletePref } from "../userStore.js";
import { getCorrelationId } from "../serverMiddleware.js";

const MAX_VALUE_BYTES = 64 * 1024; // 64 KB per pref — generous but bounded

export function createPrefsRoutes(): express.Router {
  const router = express.Router();
  const dataDir = process.env.DATA_DIR || "./data";

  router.get("/prefs", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth?.sub) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const prefs = getAllPrefs(dataDir, auth.sub);
    res.json({ success: true, correlationId, data: prefs });
  });

  router.put("/prefs/:key", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth?.sub) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const key = req.params.key;
    if (!key || key.length > 256) { res.status(400).json({ success: false, correlationId, error: "Invalid key" }); return; }
    const raw = JSON.stringify(req.body?.value);
    if (raw.length > MAX_VALUE_BYTES) { res.status(413).json({ success: false, correlationId, error: "Value too large" }); return; }
    try {
      setPref(dataDir, auth.sub, key, req.body?.value ?? null);
      res.json({ success: true, correlationId });
    } catch (err) {
      res.status(500).json({ success: false, correlationId, error: "Failed to save pref" });
    }
  });

  router.delete("/prefs/:key", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth?.sub) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const key = req.params.key;
    if (!key) { res.status(400).json({ success: false, correlationId, error: "Invalid key" }); return; }
    deletePref(dataDir, auth.sub, key);
    res.json({ success: true, correlationId });
  });

  return router;
}
