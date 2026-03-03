/**
 * FiscalIntel SQLite schema and data access layer.
 * Stores raw DLS data and computed snapshots.
 */

import type { Database } from "better-sqlite3";

// ── Schema ───────────────────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS fi_raw (
  id            TEXT PRIMARY KEY,
  municipality  TEXT NOT NULL,
  dor_code      INTEGER,
  fiscal_year   INTEGER NOT NULL,
  dataset       TEXT NOT NULL,
  data_json     TEXT NOT NULL,
  ingested_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS fi_raw_muni ON fi_raw(municipality, dataset, fiscal_year);

CREATE TABLE IF NOT EXISTS fi_sync_log (
  id            TEXT PRIMARY KEY,
  municipality  TEXT NOT NULL,
  status        TEXT NOT NULL,
  datasets      TEXT NOT NULL,
  message       TEXT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT
);

CREATE TABLE IF NOT EXISTS fi_snapshots (
  municipality  TEXT NOT NULL,
  fiscal_year   INTEGER NOT NULL,
  metrics_json  TEXT NOT NULL,
  risk_json     TEXT NOT NULL,
  computed_at   TEXT NOT NULL,
  PRIMARY KEY (municipality, fiscal_year)
);
`;

export function initFiscalDb(db: Database): void {
  db.exec(SCHEMA);
}

// ── Raw data storage ─────────────────────────────────────────────────────────

export interface RawRecord {
  municipality: string;
  dorCode: number | null;
  fiscalYear: number;
  dataset: string;
  data: Record<string, unknown>;
}

export function upsertRaw(db: Database, rec: RawRecord): void {
  const id = `${rec.dataset}:${rec.municipality}:${rec.fiscalYear}`;
  db.prepare(`
    INSERT INTO fi_raw (id, municipality, dor_code, fiscal_year, dataset, data_json, ingested_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data_json  = excluded.data_json,
      ingested_at = excluded.ingested_at
  `).run(
    id,
    rec.municipality,
    rec.dorCode ?? null,
    rec.fiscalYear,
    rec.dataset,
    JSON.stringify(rec.data),
    new Date().toISOString()
  );
}

export function getRaw(
  db: Database,
  municipality: string,
  dataset: string
): Array<{ fiscal_year: number; data: Record<string, unknown> }> {
  const rows = db.prepare(`
    SELECT fiscal_year, data_json FROM fi_raw
    WHERE municipality = ? AND dataset = ?
    ORDER BY fiscal_year DESC
  `).all(municipality, dataset) as Array<{ fiscal_year: number; data_json: string }>;

  return rows.map((r) => ({ fiscal_year: r.fiscal_year, data: JSON.parse(r.data_json) }));
}

// ── Snapshot storage ─────────────────────────────────────────────────────────

export interface FiscalSnapshot {
  municipality: string;
  fiscalYear: number;
  metrics: FiscalMetrics;
  risks: RiskFlag[];
  computedAt: string;
}

export interface FiscalMetrics {
  // Stabilization
  stabilizationBalance: number | null;
  stabilizationPctBudget: number | null;
  // Operating budget
  operatingBudget: number | null;
  // Overlay / Levy
  overlayAppropriation: number | null;
  totalLevy: number | null;
  overlayPctLevy: number | null;
  // Free cash (added when DLS source available)
  certifiedFreeCash: number | null;
  freeCashPctBudget: number | null;
  // Trend flags (YoY change)
  stabilizationTrend: "up" | "down" | "stable" | null;
  levyTrend: "up" | "down" | "stable" | null;
  // Multi-year series for charts
  stabilizationSeries: Array<{ fy: number; value: number }>;
  levySeries: Array<{ fy: number; value: number }>;
}

export interface RiskFlag {
  code: string;
  label: string;
  severity: "critical" | "warning" | "info";
  detail: string;
  threshold: string;
}

export function upsertSnapshot(db: Database, snap: FiscalSnapshot): void {
  db.prepare(`
    INSERT INTO fi_snapshots (municipality, fiscal_year, metrics_json, risk_json, computed_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(municipality, fiscal_year) DO UPDATE SET
      metrics_json = excluded.metrics_json,
      risk_json    = excluded.risk_json,
      computed_at  = excluded.computed_at
  `).run(
    snap.municipality,
    snap.fiscalYear,
    JSON.stringify(snap.metrics),
    JSON.stringify(snap.risks),
    snap.computedAt
  );
}

export function getSnapshot(
  db: Database,
  municipality: string,
  fiscalYear: number
): FiscalSnapshot | null {
  const row = db.prepare(`
    SELECT * FROM fi_snapshots
    WHERE municipality = ? AND fiscal_year = ?
  `).get(municipality, fiscalYear) as
    | { municipality: string; fiscal_year: number; metrics_json: string; risk_json: string; computed_at: string }
    | undefined;

  if (!row) return null;
  return {
    municipality: row.municipality,
    fiscalYear: row.fiscal_year,
    metrics: JSON.parse(row.metrics_json),
    risks: JSON.parse(row.risk_json),
    computedAt: row.computed_at,
  };
}

export function getLatestSnapshot(
  db: Database,
  municipality: string
): FiscalSnapshot | null {
  const row = db.prepare(`
    SELECT * FROM fi_snapshots
    WHERE municipality = ?
    ORDER BY fiscal_year DESC
    LIMIT 1
  `).get(municipality) as
    | { municipality: string; fiscal_year: number; metrics_json: string; risk_json: string; computed_at: string }
    | undefined;

  if (!row) return null;
  return {
    municipality: row.municipality,
    fiscalYear: row.fiscal_year,
    metrics: JSON.parse(row.metrics_json),
    risks: JSON.parse(row.risk_json),
    computedAt: row.computed_at,
  };
}

// ── Sync log ─────────────────────────────────────────────────────────────────

export function logSync(db: Database, opts: {
  id: string;
  municipality: string;
  status: string;
  datasets: string[];
  message?: string;
  startedAt: string;
  finishedAt?: string;
}): void {
  db.prepare(`
    INSERT INTO fi_sync_log (id, municipality, status, datasets, message, started_at, finished_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status      = excluded.status,
      message     = excluded.message,
      finished_at = excluded.finished_at
  `).run(
    opts.id,
    opts.municipality,
    opts.status,
    opts.datasets.join(","),
    opts.message ?? null,
    opts.startedAt,
    opts.finishedAt ?? null
  );
}

export function getSyncLog(db: Database, municipality?: string): unknown[] {
  if (municipality) {
    return db.prepare(`
      SELECT * FROM fi_sync_log WHERE municipality = ? ORDER BY started_at DESC LIMIT 20
    `).all(municipality);
  }
  return db.prepare(`
    SELECT * FROM fi_sync_log ORDER BY started_at DESC LIMIT 50
  `).all();
}
