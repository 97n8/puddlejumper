/**
 * Town registry API routes.
 * Exposes fiscal snapshots + staff directory data for all 351 MA municipalities.
 */

import { Router } from "express";
import type Database from "better-sqlite3";
import { ALL_MA_MUNICIPALITIES } from "../fiscalintel/municipalities.js";
import { runDailyRegistrySync } from "./dailySync.js";

export function createTownRegistryRoutes(db: Database.Database): Router {
  const router = Router();

  // GET /api/registry/towns — list all 351 towns with latest fiscal snapshot + staff count
  router.get("/towns", (_req, res) => {
    const towns = ALL_MA_MUNICIPALITIES.map((muni) => {
      const snap = db
        .prepare(
          "SELECT metrics_json, computed_at FROM fi_snapshots WHERE municipality = ? ORDER BY fiscal_year DESC LIMIT 1"
        )
        .get(muni.name) as { metrics_json: string; computed_at: string } | undefined;
      const staff = db
        .prepare(
          "SELECT staff_json, scraped_at FROM town_staff_registry WHERE town_name = ?"
        )
        .get(muni.name) as { staff_json: string; scraped_at: string } | undefined;
      return {
        name: muni.name,
        dorCode: muni.dorCode,
        county: muni.county,
        population: muni.population,
        fiscal: snap
          ? { metrics: JSON.parse(snap.metrics_json), computedAt: snap.computed_at }
          : null,
        staffCount: staff ? (JSON.parse(staff.staff_json) as unknown[]).length : null,
        staffScrapedAt: staff?.scraped_at ?? null,
      };
    });
    res.json({ towns, total: towns.length });
  });

  // GET /api/registry/town/:name — full data for one town
  router.get("/town/:name", (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const muni = ALL_MA_MUNICIPALITIES.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    if (!muni) return res.status(404).json({ error: "Town not found" });

    const snap = db
      .prepare(
        "SELECT metrics_json, risk_json, computed_at, fiscal_year FROM fi_snapshots WHERE municipality = ? ORDER BY fiscal_year DESC LIMIT 1"
      )
      .get(muni.name) as
      | { metrics_json: string; risk_json: string; computed_at: string; fiscal_year: number }
      | undefined;
    const staff = db
      .prepare(
        "SELECT staff_json, source_pages, scraped_at, notice FROM town_staff_registry WHERE town_name = ?"
      )
      .get(muni.name) as
      | { staff_json: string; source_pages: string; scraped_at: string; notice: string }
      | undefined;

    return res.json({
      name: muni.name,
      dorCode: muni.dorCode,
      county: muni.county,
      population: muni.population,
      fiscal: snap
        ? {
            metrics: JSON.parse(snap.metrics_json),
            riskFlags: JSON.parse(snap.risk_json),
            fiscalYear: snap.fiscal_year,
            computedAt: snap.computed_at,
          }
        : null,
      staff: staff
        ? {
            employees: JSON.parse(staff.staff_json),
            sourcePages: JSON.parse(staff.source_pages),
            scrapedAt: staff.scraped_at,
            notice: staff.notice,
          }
        : null,
    });
  });

  // GET /api/registry/synclog — last 10 sync runs
  router.get("/synclog", (_req, res) => {
    const rows = db
      .prepare(
        "SELECT * FROM town_registry_sync_log ORDER BY started_at DESC LIMIT 10"
      )
      .all();
    res.json({ syncs: rows });
  });

  // POST /api/registry/sync — trigger a full sync (admin use)
  router.post("/sync", (_req, res) => {
    res.status(202).json({ message: "Daily registry sync started" });
    runDailyRegistrySync(db).catch((e) =>
      console.error("[town-registry] manual sync failed:", e)
    );
  });

  return router;
}
