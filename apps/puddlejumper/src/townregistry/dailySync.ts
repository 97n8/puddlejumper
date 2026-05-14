/**
 * Daily town registry sync — fiscal data + staff directory for all 351 MA municipalities.
 *
 * Sync order:
 *  1. MMA sync — one HTTP request gets real fiscal data for all 351 towns at once.
 *  2. Per-town DLS sync — enriches with stabilization/overlay detail from MA DLS.
 *  3. Per-town staff scrape — finds real contact info from town websites.
 */

import type Database from "better-sqlite3";
import crypto from "node:crypto";
import { ALL_MA_MUNICIPALITIES } from "../fiscalintel/municipalities.js";
import { syncMunicipality } from "../fiscalintel/sync.js";
import { scrapeStaff } from "./staffScraper.js";
import { syncFromMma } from "./mmaSync.js";

export async function runDailyRegistrySync(db: Database.Database): Promise<void> {
  const syncId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO town_registry_sync_log (id, status, started_at, towns_total, towns_ok, towns_err)
     VALUES (?, 'running', ?, ?, 0, 0)`
  ).run(syncId, startedAt, ALL_MA_MUNICIPALITIES.length);

  // ── Step 1: MMA sync (one request, all 351 towns) ───────────────────────
  try {
    const mmaResult = await syncFromMma(db);
    console.info(`[town-registry] MMA sync: ${mmaResult.ok}/${mmaResult.total} towns updated`);
  } catch (e) {
    console.error("[town-registry] MMA sync failed (non-fatal):", e);
  }

  // ── Step 2: Per-town DLS + staff scrape ─────────────────────────────────
  let ok = 0;
  let err = 0;

  for (let i = 0; i < ALL_MA_MUNICIPALITIES.length; i += 10) {
    const batch = ALL_MA_MUNICIPALITIES.slice(i, i + 10);
    await Promise.allSettled(
      batch.map(async (muni) => {
        try {
          // Fiscal sync — non-fatal if it fails
          try {
            await syncMunicipality(db, muni.name);
          } catch {
            // fiscal sync failure is non-fatal
          }

          // Staff scrape — only if record is missing or older than 7 days
          const existing = db
            .prepare("SELECT scraped_at FROM town_staff_registry WHERE town_name = ?")
            .get(muni.name) as { scraped_at: string } | undefined;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

          if (!existing || existing.scraped_at < sevenDaysAgo) {
            const staffResult = await scrapeStaff(muni.name);
            db.prepare(
              `INSERT OR REPLACE INTO town_staff_registry
               (town_name, dor_code, staff_json, source_pages, scraped_at, notice)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).run(
              muni.name,
              muni.dorCode,
              JSON.stringify(staffResult.employees),
              JSON.stringify(staffResult.sourcePages),
              new Date().toISOString(),
              staffResult.notice
            );
          }

          ok++;
        } catch {
          err++;
        }
      })
    );

    // Small pause between batches to avoid rate limiting
    await new Promise((r) => setTimeout(r, 2000));
  }

  db.prepare(
    `UPDATE town_registry_sync_log SET status='success', finished_at=?, towns_ok=?, towns_err=? WHERE id=?`
  ).run(new Date().toISOString(), ok, err, syncId);
}

export function scheduleDailyRegistrySync(db: Database.Database): void {
  function scheduleNext() {
    const now = new Date();
    const target = new Date();
    target.setHours(2, 0, 0, 0); // 2 AM
    if (now >= target) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - now.getTime();

    setTimeout(() => {
      console.info("[town-registry] Starting daily sync...");
      runDailyRegistrySync(db).catch((e) =>
        console.error("[town-registry] sync failed:", e)
      );
      scheduleNext();
    }, delay).unref();
  }

  scheduleNext();
  console.info("[town-registry] Daily sync scheduled for 2 AM");
}
