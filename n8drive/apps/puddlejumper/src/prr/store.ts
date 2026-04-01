import crypto from 'node:crypto';
import type Database from 'better-sqlite3';
import type { PRRRequest, PRRStatus } from './types.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS gov_prr_requests (
    id TEXT PRIMARY KEY,
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    request_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    received_at TEXT NOT NULL,
    acknowledged_at TEXT,
    closed_at TEXT,
    closing_notes TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_gov_prr_status ON gov_prr_requests(status);
  CREATE INDEX IF NOT EXISTS idx_gov_prr_received ON gov_prr_requests(received_at);
`;

// ── Row type ──────────────────────────────────────────────────────────────────

interface PRRRow {
  id: string;
  requester_name: string;
  requester_email: string;
  request_description: string;
  status: PRRStatus;
  received_at: string;
  acknowledged_at: string | null;
  closed_at: string | null;
  closing_notes: string | null;
}

// ── Business day helpers ──────────────────────────────────────────────────────

function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let count = 0;
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function rowToPRR(row: PRRRow): PRRRequest {
  const receivedAt = new Date(row.received_at);
  const slaDueDate = addBusinessDays(receivedAt, 10);
  const slaDue = slaDueDate.toISOString();
  const now = new Date();
  const daysOpen = countBusinessDays(receivedAt, now);
  const slaBreached = now > slaDueDate && row.status !== 'closed' && row.status !== 'denied';

  return {
    id: row.id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requestDescription: row.request_description,
    status: row.status,
    receivedAt: row.received_at,
    ...(row.acknowledged_at ? { acknowledgedAt: row.acknowledged_at } : {}),
    ...(row.closed_at ? { closedAt: row.closed_at } : {}),
    ...(row.closing_notes ? { closingNotes: row.closing_notes } : {}),
    daysOpen,
    slaDue,
    slaBreached,
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initPRRStore(db: Database.Database): void {
  db.exec(SCHEMA);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function listPRRRequests(db: Database.Database): PRRRequest[] {
  const rows = db.prepare(
    `SELECT * FROM gov_prr_requests ORDER BY received_at DESC`
  ).all() as PRRRow[];
  return rows.map(rowToPRR);
}

export function createPRRRequest(
  db: Database.Database,
  data: Pick<PRRRequest, 'requesterName' | 'requesterEmail' | 'requestDescription'>
): PRRRequest {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO gov_prr_requests
      (id, requester_name, requester_email, request_description, status, received_at)
     VALUES (?, ?, ?, ?, 'new', ?)`
  ).run(id, data.requesterName, data.requesterEmail, data.requestDescription, now);
  return rowToPRR(
    db.prepare(`SELECT * FROM gov_prr_requests WHERE id = ?`).get(id) as PRRRow
  );
}

export function acknowledgePRRRequest(db: Database.Database, id: string): PRRRequest | null {
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE gov_prr_requests SET status = 'acknowledged', acknowledged_at = ? WHERE id = ?`
  ).run(now, id);
  if (result.changes === 0) return null;
  return rowToPRR(
    db.prepare(`SELECT * FROM gov_prr_requests WHERE id = ?`).get(id) as PRRRow
  );
}

export function closePRRRequest(
  db: Database.Database,
  id: string,
  notes?: string
): PRRRequest | null {
  const now = new Date().toISOString();
  const result = db.prepare(
    `UPDATE gov_prr_requests SET status = 'closed', closed_at = ?, closing_notes = ? WHERE id = ?`
  ).run(now, notes ?? null, id);
  if (result.changes === 0) return null;
  return rowToPRR(
    db.prepare(`SELECT * FROM gov_prr_requests WHERE id = ?`).get(id) as PRRRow
  );
}
