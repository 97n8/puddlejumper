/**
 * Town registry API routes.
 * Exposes fiscal snapshots + staff directory data for all 351 MA municipalities.
 */

import { Router } from "express";
import type Database from "better-sqlite3";
import { ALL_MA_MUNICIPALITIES } from "../fiscalintel/municipalities.js";
import { runDailyRegistrySync } from "./dailySync.js";
import { syncFromMma } from "./mmaSync.js";
import { fetchMMAProfile, townNameToMMASlug, type MMAProfile } from "./mmaScraper.js";
import { fetchMassGISData, type MassGISMuniData } from "./massGISScraper.js";
import { fetchLocalBills, fetchAllMembers, type LocalBill, type MALegMember } from "./maLegScraper.js";

const MMA_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;            // 7 days
const MASSGIS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;       // 30 days (census data)
const LEGISLATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;        // 24 hours
const MEMBERS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;        // 7 days

function ensureTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mma_profiles (
      slug        TEXT PRIMARY KEY,
      town_name   TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS massgis_data (
      town_upper  TEXT PRIMARY KEY,
      town_name   TEXT NOT NULL,
      data_json   TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS town_legislation (
      town_upper  TEXT PRIMARY KEY,
      town_name   TEXT NOT NULL,
      bills_json  TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ma_leg_members (
      id          TEXT PRIMARY KEY DEFAULT 'all',
      members_json TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    );
  `);
}

export function createTownRegistryRoutes(db: Database.Database): Router {
  const router = Router();
  ensureTables(db);

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

  // GET /api/registry/town/:name/mma — MMA Data Hub profile (demographics, finances, governance, reps)
  // Cached in SQLite for 7 days; pass ?refresh=1 to force re-fetch.
  router.get("/town/:name/mma", async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const muni = ALL_MA_MUNICIPALITIES.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    if (!muni) return res.status(404).json({ error: "Town not found" });

    const slug = townNameToMMASlug(muni.name);
    const forceRefresh = req.query["refresh"] === "1";

    if (!forceRefresh) {
      const cached = db
        .prepare("SELECT profile_json, fetched_at FROM mma_profiles WHERE slug = ?")
        .get(slug) as { profile_json: string; fetched_at: string } | undefined;
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < MMA_CACHE_TTL_MS) {
          return res.json({
            source: "cache",
            profile: JSON.parse(cached.profile_json) as MMAProfile,
          });
        }
      }
    }

    try {
      const profile = await fetchMMAProfile(muni.name);
      db.prepare(
        "INSERT OR REPLACE INTO mma_profiles (slug, town_name, profile_json, fetched_at) VALUES (?, ?, ?, ?)"
      ).run(slug, muni.name, JSON.stringify(profile), profile.fetchedAt);
      return res.json({ source: "live", profile });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Serve stale cache on error rather than failing hard
      const stale = db
        .prepare("SELECT profile_json, fetched_at FROM mma_profiles WHERE slug = ?")
        .get(slug) as { profile_json: string; fetched_at: string } | undefined;
      if (stale) {
        return res.json({
          source: "stale-cache",
          profile: JSON.parse(stale.profile_json) as MMAProfile,
          warning: `Live fetch failed: ${errMsg}`,
        });
      }
      return res.status(502).json({ error: `MMA fetch failed: ${errMsg}` });
    }
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

  // POST /api/registry/sync-mma — trigger just the fast MMA sync (no DLS/scrape)
  router.post("/sync-mma", (_req, res) => {
    res.status(202).json({ message: "MMA sync started — populates fiscal data for all 351 towns" });
    syncFromMma(db).then(r => {
      console.info("[town-registry] MMA sync complete:", r);
    }).catch((e) =>
      console.error("[town-registry] MMA sync failed:", e)
    );
  });

  // GET /api/registry/town/:name/massgis — MassGIS population history + area (30-day cache)
  router.get("/town/:name/massgis", async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const muni = ALL_MA_MUNICIPALITIES.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!muni) return res.status(404).json({ error: "Town not found" });

    const key = muni.name.replace(/^(city|town) of (the )?/i, '').toUpperCase().trim();
    const forceRefresh = req.query["refresh"] === "1";

    if (!forceRefresh) {
      const cached = db.prepare("SELECT data_json, fetched_at FROM massgis_data WHERE town_upper = ?")
        .get(key) as { data_json: string; fetched_at: string } | undefined;
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < MASSGIS_CACHE_TTL_MS) {
          return res.json({ source: "cache", data: JSON.parse(cached.data_json) as MassGISMuniData });
        }
      }
    }

    try {
      const data = await fetchMassGISData(muni.name);
      db.prepare("INSERT OR REPLACE INTO massgis_data (town_upper, town_name, data_json, fetched_at) VALUES (?, ?, ?, ?)")
        .run(key, muni.name, JSON.stringify(data), data.fetchedAt);
      return res.json({ source: "live", data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stale = db.prepare("SELECT data_json FROM massgis_data WHERE town_upper = ?").get(key) as { data_json: string } | undefined;
      if (stale) return res.json({ source: "stale-cache", data: JSON.parse(stale.data_json) as MassGISMuniData, warning: msg });
      return res.status(502).json({ error: `MassGIS fetch failed: ${msg}` });
    }
  });

  // GET /api/registry/town/:name/legislation — local bills from MA Legislature (24h cache)
  router.get("/town/:name/legislation", async (req, res) => {
    const name = decodeURIComponent(req.params.name);
    const muni = ALL_MA_MUNICIPALITIES.find(m => m.name.toLowerCase() === name.toLowerCase());
    if (!muni) return res.status(404).json({ error: "Town not found" });

    const key = muni.name.toUpperCase();
    const forceRefresh = req.query["refresh"] === "1";

    if (!forceRefresh) {
      const cached = db.prepare("SELECT bills_json, fetched_at FROM town_legislation WHERE town_upper = ?")
        .get(key) as { bills_json: string; fetched_at: string } | undefined;
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < LEGISLATION_CACHE_TTL_MS) {
          return res.json({ source: "cache", bills: JSON.parse(cached.bills_json) as LocalBill[], fetchedAt: cached.fetched_at });
        }
      }
    }

    try {
      const bills = await fetchLocalBills(muni.name);
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO town_legislation (town_upper, town_name, bills_json, fetched_at) VALUES (?, ?, ?, ?)")
        .run(key, muni.name, JSON.stringify(bills), now);
      return res.json({ source: "live", bills, fetchedAt: now });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stale = db.prepare("SELECT bills_json, fetched_at FROM town_legislation WHERE town_upper = ?").get(key) as { bills_json: string; fetched_at: string } | undefined;
      if (stale) return res.json({ source: "stale-cache", bills: JSON.parse(stale.bills_json) as LocalBill[], fetchedAt: stale.fetched_at, warning: msg });
      return res.json({ source: "live", bills: [], fetchedAt: new Date().toISOString() });
    }
  });

  // GET /api/registry/members — all 203 current MA legislative members (7-day cache)
  router.get("/members", async (req, res) => {
    const forceRefresh = req.query["refresh"] === "1";

    if (!forceRefresh) {
      const cached = db.prepare("SELECT members_json, fetched_at FROM ma_leg_members WHERE id = 'all'")
        .get() as { members_json: string; fetched_at: string } | undefined;
      if (cached) {
        const age = Date.now() - new Date(cached.fetched_at).getTime();
        if (age < MEMBERS_CACHE_TTL_MS) {
          return res.json({ source: "cache", members: JSON.parse(cached.members_json) as MALegMember[], fetchedAt: cached.fetched_at });
        }
      }
    }

    try {
      const members = await fetchAllMembers();
      const now = new Date().toISOString();
      db.prepare("INSERT OR REPLACE INTO ma_leg_members (id, members_json, fetched_at) VALUES ('all', ?, ?)")
        .run(JSON.stringify(members), now);
      return res.json({ source: "live", members, fetchedAt: now });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stale = db.prepare("SELECT members_json, fetched_at FROM ma_leg_members WHERE id = 'all'").get() as { members_json: string; fetched_at: string } | undefined;
      if (stale) return res.json({ source: "stale-cache", members: JSON.parse(stale.members_json) as MALegMember[], fetchedAt: stale.fetched_at, warning: msg });
      return res.status(502).json({ error: `MA Legislature fetch failed: ${msg}` });
    }
  });

  return router;
}
