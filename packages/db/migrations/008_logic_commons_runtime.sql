-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 008 — LogicCommons runtime substrate
-- Adds canonical runtime tables for CaseSpaces, work items, and ARCHIEVE seals.
-- Extends the existing canon holds table so PRM can reason over resources,
-- windows, and source work items without creating a parallel store.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casespaces (
  casespace_id       TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenants(id),
  slug               TEXT NOT NULL,
  name               TEXT NOT NULL,
  domain_key         TEXT NOT NULL,
  skin_key           TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'paused', 'archived')),
  owner_identity_id  TEXT REFERENCES identities(identity_id),
  metadata_json      TEXT NOT NULL DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_casespaces_tenant_slug
  ON casespaces (tenant_id, slug);

CREATE INDEX IF NOT EXISTS idx_casespaces_domain
  ON casespaces (tenant_id, domain_key, status);

CREATE TABLE IF NOT EXISTS work_items (
  work_item_id          TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES tenants(id),
  casespace_ref         TEXT REFERENCES casespaces(casespace_id),
  process_id            TEXT UNIQUE REFERENCES processes(process_id),
  parent_work_item_id   TEXT REFERENCES work_items(work_item_id),
  runtime_key           TEXT NOT NULL,
  ops_preset            TEXT NOT NULL,
  skin_key              TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'received'
                          CHECK (status IN (
                            'received', 'logged', 'assigned', 'searching',
                            'reviewing', 'responded', 'closed',
                            'blocked', 'archived'
                          )),
  subject_ref           TEXT,
  owner_identity_id     TEXT REFERENCES identities(identity_id),
  default_pool          TEXT,
  needed_by             TEXT,
  blocked_reason        TEXT,
  decision_required     INTEGER NOT NULL DEFAULT 0 CHECK (decision_required IN (0, 1)),
  fields_json           TEXT NOT NULL DEFAULT '{}',
  links_json            TEXT NOT NULL DEFAULT '[]',
  resources_json        TEXT NOT NULL DEFAULT '[]',
  evidence_json         TEXT NOT NULL DEFAULT '[]',
  skin_snapshot_json    TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at           TEXT
);

CREATE INDEX IF NOT EXISTS idx_work_items_status
  ON work_items (tenant_id, status, needed_by);

CREATE INDEX IF NOT EXISTS idx_work_items_casespace
  ON work_items (tenant_id, casespace_ref, status);

CREATE INDEX IF NOT EXISTS idx_work_items_parent
  ON work_items (tenant_id, parent_work_item_id);

ALTER TABLE holds ADD COLUMN work_item_id    TEXT REFERENCES work_items(work_item_id);
ALTER TABLE holds ADD COLUMN hold_kind       TEXT NOT NULL DEFAULT 'scheduled'
  CHECK (hold_kind IN ('scheduled', 'locked', 'derived', 'advisory'));
ALTER TABLE holds ADD COLUMN pool            TEXT;
ALTER TABLE holds ADD COLUMN resource_ref    TEXT;
ALTER TABLE holds ADD COLUMN starts_at       TEXT;
ALTER TABLE holds ADD COLUMN ends_at         TEXT;
ALTER TABLE holds ADD COLUMN needed_by       TEXT;
ALTER TABLE holds ADD COLUMN resources_json  TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_holds_work_item
  ON holds (tenant_id, work_item_id, status);

CREATE INDEX IF NOT EXISTS idx_holds_resource_window
  ON holds (tenant_id, resource_ref, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS seals (
  seal_sequence       INTEGER PRIMARY KEY AUTOINCREMENT,
  seal_id             TEXT NOT NULL UNIQUE,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id),
  work_item_id        TEXT REFERENCES work_items(work_item_id),
  process_id          TEXT REFERENCES processes(process_id),
  from_event_id       TEXT NOT NULL REFERENCES audit_events(event_id),
  to_event_id         TEXT NOT NULL REFERENCES audit_events(event_id),
  event_count         INTEGER NOT NULL CHECK (event_count > 0),
  manifest_json       TEXT NOT NULL,
  seal_hash           TEXT NOT NULL,
  prev_seal_hash      TEXT,
  created_by_ref      TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_seals_to_event
  ON seals (tenant_id, to_event_id);

CREATE INDEX IF NOT EXISTS idx_seals_work_item
  ON seals (tenant_id, work_item_id, created_at);

CREATE INDEX IF NOT EXISTS idx_seals_sequence
  ON seals (tenant_id, seal_sequence);
