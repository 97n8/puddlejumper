// ── Runtime config, manifest, tiles, capabilities routes ────────────────────
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
import { buildCapabilityManifest, listAllowedPjActions } from "../capabilities.js";

type ConfigRoutesOptions = {
  runtimeContext: RuntimeContext | null;
  runtimeTiles: LiveTile[];
  runtimeCapabilities: LiveCapabilities | null;
};

export function createConfigRoutes(opts: ConfigRoutesOptions): express.Router {
  const router = express.Router();

  router.get("/runtime/context", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!opts.runtimeContext) { res.status(503).json({ error: "Runtime context unavailable" }); return; }
    res.json({
      workspace: opts.runtimeContext.workspace,
      municipality: opts.runtimeContext.municipality,
      actionDefaults: opts.runtimeContext.actionDefaults ?? {},
      operator: { id: auth.userId, name: auth.name, role: auth.role, permissions: auth.permissions, delegations: auth.delegations },
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/config/tiles", requireAuthenticated(), (_req, res) => {
    if (opts.runtimeTiles.length === 0) { res.status(503).json({ error: "Runtime tiles unavailable" }); return; }
    res.json(opts.runtimeTiles);
  });

  router.get("/config/capabilities", requireAuthenticated(), (_req, res) => {
    if (!opts.runtimeCapabilities) { res.status(503).json({ error: "Runtime capabilities unavailable" }); return; }
    res.json(opts.runtimeCapabilities);
  });

  router.get("/capabilities/manifest", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.json(buildCapabilityManifest(auth, opts.runtimeTiles, opts.runtimeCapabilities));
  });

  router.get("/pj/actions", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const manifest = buildCapabilityManifest(auth, opts.runtimeTiles, opts.runtimeCapabilities);
    res.json(listAllowedPjActions(manifest));
  });

  router.get("/sample", requireAuthenticated(), (_req, res) => {
    res.status(404).json({ error: "Not available" });
  });

  return router;
}
