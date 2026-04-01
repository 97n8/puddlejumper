import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { FiscalYear, FinancialModel } from './types.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS fiscal_years (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS financial_models (
    id TEXT PRIMARY KEY,
    scenario_label TEXT NOT NULL,
    principal REAL NOT NULL DEFAULT 0,
    annual_rate REAL NOT NULL DEFAULT 0,
    compounding_periods INTEGER NOT NULL DEFAULT 12,
    duration_years INTEGER NOT NULL DEFAULT 10,
    periodic_contribution REAL NOT NULL DEFAULT 0,
    contribution_frequency TEXT NOT NULL DEFAULT 'monthly',
    projection_series TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );
`;

// ── Row types ─────────────────────────────────────────────────────────────────

interface FiscalYearRow {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: FiscalYear['status'];
  created_at: string;
}

interface FinancialModelRow {
  id: string;
  scenario_label: string;
  principal: number;
  annual_rate: number;
  compounding_periods: number;
  duration_years: number;
  periodic_contribution: number;
  contribution_frequency: FinancialModel['contributionFrequency'];
  projection_series: string;
  created_at: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToFiscalYear(row: FiscalYearRow): FiscalYear {
  return {
    id: row.id,
    label: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToFinancialModel(row: FinancialModelRow): FinancialModel {
  return {
    id: row.id,
    scenarioLabel: row.scenario_label,
    principal: row.principal,
    annualRate: row.annual_rate,
    compoundingPeriods: row.compounding_periods,
    durationYears: row.duration_years,
    periodicContribution: row.periodic_contribution,
    contributionFrequency: row.contribution_frequency,
    projectionSeries: JSON.parse(row.projection_series || '[]') as unknown[],
    createdAt: row.created_at,
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initFinanceStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

// ── Fiscal Years ──────────────────────────────────────────────────────────────

export function listFiscalYears(db: Database.Database): FiscalYear[] {
  const rows = db.prepare(
    `SELECT * FROM fiscal_years ORDER BY start_date DESC`
  ).all() as FiscalYearRow[];
  return rows.map(rowToFiscalYear);
}

export function createFiscalYear(
  db: Database.Database,
  data: Pick<FiscalYear, 'label' | 'startDate' | 'endDate' | 'status'>
): FiscalYear {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO fiscal_years (id, label, start_date, end_date, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.label, data.startDate, data.endDate, data.status ?? 'draft', now);
  return rowToFiscalYear(
    db.prepare(`SELECT * FROM fiscal_years WHERE id = ?`).get(id) as FiscalYearRow
  );
}

// ── Financial Models ──────────────────────────────────────────────────────────

export function listFinancialModels(db: Database.Database): FinancialModel[] {
  const rows = db.prepare(
    `SELECT * FROM financial_models ORDER BY created_at DESC`
  ).all() as FinancialModelRow[];
  return rows.map(rowToFinancialModel);
}

export function createFinancialModel(
  db: Database.Database,
  data: Omit<FinancialModel, 'id' | 'createdAt'>
): FinancialModel {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO financial_models
      (id, scenario_label, principal, annual_rate, compounding_periods,
       duration_years, periodic_contribution, contribution_frequency,
       projection_series, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.scenarioLabel,
    data.principal,
    data.annualRate,
    data.compoundingPeriods,
    data.durationYears,
    data.periodicContribution,
    data.contributionFrequency,
    JSON.stringify(data.projectionSeries ?? []),
    now
  );
  return rowToFinancialModel(
    db.prepare(`SELECT * FROM financial_models WHERE id = ?`).get(id) as FinancialModelRow
  );
}

export function deleteFinancialModel(db: Database.Database, id: string): boolean {
  const result = db.prepare(`DELETE FROM financial_models WHERE id = ?`).run(id);
  return result.changes > 0;
}
