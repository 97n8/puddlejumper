/**
 * FiscalIntel API Routes
 * Exposes MA DLS fiscal health data for LogicOS front-end.
 *
 * GET  /api/fiscal/municipalities          — list all municipalities with DOR codes
 * GET  /api/fiscal/snapshot?name=Sutton    — latest computed fiscal snapshot
 * POST /api/fiscal/sync                    — trigger DLS data pull for a town
 * GET  /api/fiscal/peers?name=Sutton       — peer county comparison
 * GET  /api/fiscal/synclog?name=Sutton     — sync history
 */

import { Router } from "express";
import type { Database } from "better-sqlite3";
import { getLatestSnapshot, getSnapshot, getSyncLog } from "./db.js";
import { syncMunicipality } from "./sync.js";
import { computePeerComparisons } from "./intelligence.js";
import { ALL_MUNICIPALITIES, findByName } from "./municipalities.js";

export function createFiscalRoutes(db: Database): Router {
  const router = Router();

  // ── GET /fiscal/municipalities ────────────────────────────────────────────
  router.get("/municipalities", (_req, res) => {
    res.json({
      municipalities: ALL_MUNICIPALITIES.map((m) => ({
        name: m.name,
        dorCode: m.dorCode,
        county: m.county,
      })),
    });
  });

  // ── GET /fiscal/snapshot ──────────────────────────────────────────────────
  router.get("/snapshot", (req, res) => {
    const name = req.query.name as string;
    const fy = req.query.fy ? parseInt(req.query.fy as string, 10) : null;

    if (!name) {
      res.status(400).json({ error: "?name= is required" });
      return;
    }

    const muni = findByName(name);
    if (!muni) {
      res.status(404).json({ error: `Municipality not found: ${name}` });
      return;
    }

    const snap = fy
      ? getSnapshot(db, muni.name, fy)
      : getLatestSnapshot(db, muni.name);

    if (!snap) {
      res.status(404).json({
        error: "No data found. Run a sync first.",
        hint: `POST /api/fiscal/sync with { "name": "${name}" }`,
      });
      return;
    }

    res.json({
      municipality: snap.municipality,
      dorCode: muni.dorCode,
      county: muni.county,
      fiscalYear: snap.fiscalYear,
      computedAt: snap.computedAt,
      metrics: snap.metrics,
      riskFlags: snap.risks,
    });
  });

  // ── POST /fiscal/sync ─────────────────────────────────────────────────────
  router.post("/sync", async (req, res) => {
    const name = req.body?.name as string | undefined;

    if (!name) {
      res.status(400).json({ error: '"name" is required in request body' });
      return;
    }

    const muni = findByName(name);
    if (!muni) {
      res.status(404).json({ error: `Municipality not found: ${name}` });
      return;
    }

    const years = req.body?.years as number[] | undefined;

    // Run sync in background, return accepted immediately
    res.status(202).json({
      message: `Sync started for ${muni.name}`,
      municipality: muni.name,
      dorCode: muni.dorCode,
    });

    // Fire and forget (client polls via snapshot endpoint)
    syncMunicipality(db, muni.name, { years }).then((result) => {
      console.log(`[FiscalIntel] Sync complete: ${result.message}`);
    }).catch((err) => {
      console.error("[FiscalIntel] Sync error:", err);
    });
  });

  // ── GET /fiscal/peers ─────────────────────────────────────────────────────
  router.get("/peers", (req, res) => {
    const name = req.query.name as string;
    const fy = req.query.fy ? parseInt(req.query.fy as string, 10) : null;

    if (!name) {
      res.status(400).json({ error: "?name= is required" });
      return;
    }

    const snap = fy
      ? getSnapshot(db, name, fy)
      : getLatestSnapshot(db, name);

    if (!snap) {
      res.status(404).json({ error: "No snapshot found. Sync first." });
      return;
    }

    const comparisons = computePeerComparisons(db, name, snap.fiscalYear, snap.metrics);

    res.json({
      municipality: name,
      fiscalYear: snap.fiscalYear,
      comparisons,
    });
  });

  // ── GET /fiscal/synclog ───────────────────────────────────────────────────
  router.get("/synclog", (req, res) => {
    const name = req.query.name as string | undefined;
    const log = getSyncLog(db, name);
    res.json({ log });
  });

  return router;
}
