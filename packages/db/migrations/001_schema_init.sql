-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 001 — schema init
-- Source: Master Build Spec v1.1, Part 11 (Database Schema).
-- Status: canon reference. Applies to a fresh single-DB deployment.
-- See README.md in this directory for how this relates to live migrations.
-- ─────────────────────────────────────────────────────────────────────────────

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  canon_version TEXT NOT NULL DEFAULT '1.0.0',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS identities (
  identity_id    TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  kind           TEXT NOT NULL CHECK (kind IN ('person','service','delegation')),
  active         INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deactivated_at TEXT
);

CREATE TABLE IF NOT EXISTS processes (
  process_id     TEXT PRIMARY KEY,
  process_type   TEXT NOT NULL CHECK (process_type IN ('PRR','PROCUREMENT','MEETING','CUSTOM')),
  canon_version  TEXT NOT NULL,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  deployment_id  TEXT NOT NULL,
  current_state  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_by_ref TEXT NOT NULL,
  assignee_ref   TEXT,
  closed_at      TEXT,
  fields         TEXT NOT NULL DEFAULT '{}',
  links          TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_processes_tenant   ON processes (tenant_id, current_state);
CREATE INDEX IF NOT EXISTS idx_processes_assignee ON processes (assignee_ref);
CREATE INDEX IF NOT EXISTS idx_processes_type     ON processes (process_type, tenant_id);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id   TEXT PRIMARY KEY,
  process_id      TEXT NOT NULL REFERENCES processes(process_id),
  identity_id     TEXT NOT NULL REFERENCES identities(identity_id),
  role_type       TEXT NOT NULL CHECK (role_type IN (
                    'requestor','intake','assignee','reviewer',
                    'approver','records_officer','auditor','administrator')),
  tenant_id       TEXT NOT NULL,
  assigned_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unassigned_at   TEXT,
  assigned_by_ref TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  event_id       TEXT PRIMARY KEY,
  event_family   TEXT NOT NULL CHECK (event_family IN (
                   'process','transition','role','auth','divergence','system')),
  event_subtype  TEXT NOT NULL,
  canon_version  TEXT NOT NULL,
  deployment_id  TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,
  process_id     TEXT,
  actor_ref      TEXT,
  occurred_at    TEXT NOT NULL,
  inserted_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_json   TEXT NOT NULL,
  payload_hash   TEXT NOT NULL,
  prior_event_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_family  ON audit_events (event_family, event_subtype);
CREATE INDEX IF NOT EXISTS idx_audit_process ON audit_events (process_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_tenant  ON audit_events (tenant_id, occurred_at);

-- ── CANON TRIGGERS (Rule 2) — DO NOT REMOVE ────────────────────────────────
CREATE TRIGGER IF NOT EXISTS audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only (canon): UPDATE refused');
END;

CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only (canon): DELETE refused');
END;
