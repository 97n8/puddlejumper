/**
 * FiscalIntel Sync Service
 * Orchestrates DLS data fetching, HTML parsing, and storage.
 */

import type { Database } from "better-sqlite3";
import { fetchDlsReport, DLS_REPORTS } from "./dls/connector.js";
import { parseDlsTable, parseNumber } from "./dls/htmlParser.js";
import { upsertRaw, logSync } from "./db.js";
import { findByName } from "./municipalities.js";
import { buildAndStoreSnapshot } from "./intelligence.js";

// ── Parsers for each DLS report ───────────────────────────────────────────────

function parseStabilizationRows(html: string, municipality: string): Array<{ fy: number; data: Record<string, unknown> }> {
  const { rows } = parseDlsTable(html);
  const result: Array<{ fy: number; data: Record<string, unknown> }> = [];

  for (const row of rows) {
    // Filter to this municipality (DLS returns the filtered set, but double-check)
    const rowMuni = row["Municipality"] ?? row["municipality"] ?? "";
    if (rowMuni && !rowMuni.toLowerCase().includes(municipality.toLowerCase())) continue;

    // Fiscal year column is labeled "Schedule A Fiscal Year" or "Fiscal Year"
    const fyRaw = row["Schedule A Fiscal Year"] ?? row["Fiscal Year"] ?? "";
    const fy = parseInt(fyRaw, 10);
    if (!fy) continue;

    result.push({
      fy,
      data: {
        stabilizationFund: parseNumber(row["Stabilization Fund Balance"]),
        specialStabFund: parseNumber(row["Special Purpose Stabilization Fund Balance"]),
        totalStab: parseNumber(row["Total Stabilization Fund Balance"]),
        operatingBudget: parseNumber(row["Operating Budget"]),
        stabPctBudget: parseNumber(row["Stabilization Fund as % of Budget"]),
        specialStabPctBudget: parseNumber(row["Special Purpose Stabilization as % of Budget"]),
        totalStabPct: parseNumber(row["Total Stabilization as % of Budget"]),
      },
    });
  }
  return result;
}

function parseOverlayRows(html: string, municipality: string): Array<{ fy: number; data: Record<string, unknown> }> {
  const { rows } = parseDlsTable(html);
  const result: Array<{ fy: number; data: Record<string, unknown> }> = [];

  for (const row of rows) {
    const rowMuni = row["Municipality"] ?? row["municipality"] ?? "";
    if (rowMuni && !rowMuni.toLowerCase().includes(municipality.toLowerCase())) continue;

    const fyRaw = row["Fiscal Year"] ?? row["Schedule A Fiscal Year"] ?? "";
    const fy = parseInt(fyRaw, 10);
    if (!fy) continue;

    result.push({
      fy,
      data: {
        overlayAppropriation: parseNumber(row["Overlay Appropriation"]),
        totalLevy: parseNumber(row["Total Levy"]),
        overlayPctLevy: parseNumber(row["Overlay as a % of Total Levy"]),
      },
    });
  }
  return result;
}

// ── Main sync function ────────────────────────────────────────────────────────

export async function syncMunicipality(
  db: Database,
  municipalityName: string,
  opts: { years?: number[] } = {}
): Promise<{ success: boolean; message: string; recordsIngested: number }> {
  const muni = findByName(municipalityName);
  if (!muni) {
    return { success: false, message: `Unknown municipality: ${municipalityName}`, recordsIngested: 0 };
  }

  const syncId = `${muni.name}:${Date.now()}`;
  const startedAt = new Date().toISOString();
  const years = opts.years ?? [2022, 2023, 2024, 2025, 2026];

  logSync(db, {
    id: syncId,
    municipality: muni.name,
    status: "running",
    datasets: ["stabilization", "overlay"],
    startedAt,
  });

  let recordsIngested = 0;

  try {
    // ── Fetch stabilization data ─────────────────────────────────────────────
    console.info(`[FiscalIntel] Fetching stabilization data for ${muni.name}...`);
    const stabHtml = await fetchDlsReport({
      report: DLS_REPORTS.STABILIZATION,
      municipalities: [muni.name],
      years,
    });
    const stabRows = parseStabilizationRows(stabHtml, muni.name);

    for (const { fy, data } of stabRows) {
      upsertRaw(db, {
        municipality: muni.name,
        dorCode: muni.dorCode,
        fiscalYear: fy,
        dataset: "stabilization",
        data,
      });
      recordsIngested++;
    }

    // ── Fetch overlay/levy data ──────────────────────────────────────────────
    console.info(`[FiscalIntel] Fetching overlay/levy data for ${muni.name}...`);
    const overlayHtml = await fetchDlsReport({
      report: DLS_REPORTS.OVERLAY_LEVY,
      municipalities: [muni.name],
      years,
    });
    const overlayRows = parseOverlayRows(overlayHtml, muni.name);

    for (const { fy, data } of overlayRows) {
      upsertRaw(db, {
        municipality: muni.name,
        dorCode: muni.dorCode,
        fiscalYear: fy,
        dataset: "overlay",
        data,
      });
      recordsIngested++;
    }

    // ── Compute and store snapshot for latest FY ─────────────────────────────
    const latestFy = Math.max(...years);
    buildAndStoreSnapshot(db, muni.name, latestFy);

    const finishedAt = new Date().toISOString();
    logSync(db, {
      id: syncId,
      municipality: muni.name,
      status: "success",
      datasets: ["stabilization", "overlay"],
      message: `Ingested ${recordsIngested} records`,
      startedAt,
      finishedAt,
    });

    return { success: true, message: `Synced ${muni.name}: ${recordsIngested} records ingested`, recordsIngested };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logSync(db, {
      id: syncId,
      municipality: muni.name,
      status: "error",
      datasets: ["stabilization", "overlay"],
      message: errMsg,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    console.error(`[FiscalIntel] Sync failed for ${muni.name}:`, err);
    return { success: false, message: errMsg, recordsIngested };
  }
}

/** Sync all Worcester County towns. Run this as a scheduled job. */
export async function syncAllWorcesterCounty(db: Database): Promise<void> {
  const { WORCESTER_COUNTY } = await import("./municipalities.js");
  for (const muni of WORCESTER_COUNTY) {
    const result = await syncMunicipality(db, muni.name);
    console.info(`[FiscalIntel] ${muni.name}: ${result.message}`);
  }
}
