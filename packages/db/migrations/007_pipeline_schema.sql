-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 007 — V1 pipeline schema (Issue #99, step C2)
-- Source of truth: ops/v1/C0_DIAGNOSIS.md ("Missing V1 Schema") + @pj/pipeline C1.
--
-- Adds the eight tables the V1 spine needs. C2 is schema-only: no runtime
-- logic, no writers, no FKs to legacy `casespaces` (which lives in the app
-- migrations, NOT in @pj/db canon — see C0). `case_space_id` columns are
-- therefore plain indexed TEXT. JSON payloads are stored as TEXT; enums are
-- enforced with CHECK constraints; every table is tenant-scoped.
--
-- Index design follows the active-lookup / case_space / status / source
-- pointer access patterns called for by Issue #99.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── rule_packs ───────────────────────────────────────────────────────────────
-- Active rule pack resolution by tenant + module + environment (C3). Exactly
-- one active pack per (tenant, module, environment), enforced by the partial
-- unique index on is_active = 1.
CREATE TABLE IF NOT EXISTS rule_packs (
  rule_pack_id  TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  module        TEXT NOT NULL,
  environment   TEXT NOT NULL,
  pack          TEXT NOT NULL,                 -- e.g. 'guestops.stay'
  version       TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  content_json  TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- One active rule pack per (tenant, module, environment); inactive rows accrue.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_packs_active
  ON rule_packs (tenant_id, module, environment)
  WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_rule_packs_lookup
  ON rule_packs (tenant_id, module, environment, is_active);

-- ── holds ────────────────────────────────────────────────────────────────────
-- First-class holds (C6). C2 only fixes the shape + status enum; resume logic
-- (resolveHold resumes at VAULT) is a later step.
CREATE TABLE IF NOT EXISTS holds (
  hold_id        TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  case_space_id  TEXT,
  form_id        TEXT,
  process_id     TEXT,
  action         TEXT,
  status         TEXT NOT NULL DEFAULT 'held'
                   CHECK (status IN ('held', 'released', 'expired')),
  reason         TEXT,
  payload_json   TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  released_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_holds_case_space
  ON holds (tenant_id, case_space_id, status);

CREATE INDEX IF NOT EXISTS idx_holds_form
  ON holds (tenant_id, form_id);

-- ── incoming_items ───────────────────────────────────────────────────────────
-- + New Item / Capture staging. Confidence review (clear/low/unclassified) and
-- intake status are constrained; classification is filled by a later step.
CREATE TABLE IF NOT EXISTS incoming_items (
  item_id                  TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL,
  suggested_case_space_id  TEXT,
  source_type              TEXT,
  doc_class                TEXT,
  confidence               TEXT NOT NULL DEFAULT 'unclassified'
                             CHECK (confidence IN ('clear', 'low', 'unclassified')),
  status                   TEXT NOT NULL DEFAULT 'received'
                             CHECK (status IN ('received', 'held', 'confirmed', 'rejected')),
  payload_json             TEXT NOT NULL DEFAULT '{}',
  created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_incoming_items_case_space
  ON incoming_items (tenant_id, suggested_case_space_id, status);

CREATE INDEX IF NOT EXISTS idx_incoming_items_source
  ON incoming_items (tenant_id, source_type, status);

-- ── output_templates ─────────────────────────────────────────────────────────
-- FormKey output template definitions (C8). Schema-only in C2.
CREATE TABLE IF NOT EXISTS output_templates (
  template_id   TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  module        TEXT,
  environment   TEXT,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL DEFAULT '1',
  is_active     INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  body_json     TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_output_templates_lookup
  ON output_templates (tenant_id, module, environment, is_active);

-- ── generated_outputs ────────────────────────────────────────────────────────
-- Rendered, governed outputs (C8). Output status is constrained.
CREATE TABLE IF NOT EXISTS generated_outputs (
  output_id      TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  case_space_id  TEXT,
  template_id    TEXT,
  process_id     TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'generated', 'saved', 'failed')),
  content_json   TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_generated_outputs_case_space
  ON generated_outputs (tenant_id, case_space_id, status);

CREATE INDEX IF NOT EXISTS idx_generated_outputs_template
  ON generated_outputs (tenant_id, template_id);

-- ── case_space_action_state ──────────────────────────────────────────────────
-- Honest per-action state (C6): attempted / pending / done / failed. One state
-- row per (tenant, case_space, module, action).
CREATE TABLE IF NOT EXISTS case_space_action_state (
  action_state_id  TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  case_space_id    TEXT NOT NULL,
  module           TEXT NOT NULL,
  action           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'attempted'
                     CHECK (status IN ('attempted', 'pending', 'done', 'failed')),
  payload_json     TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_case_space_action_state
  ON case_space_action_state (tenant_id, case_space_id, module, action);

CREATE INDEX IF NOT EXISTS idx_case_space_action_state_status
  ON case_space_action_state (tenant_id, case_space_id, status);

-- ── connector_grants ─────────────────────────────────────────────────────────
-- Backend connector grants tied to authenticated actor + tenant + CaseSpace
-- (NOT auth providers — see C0 auth lock). Token storage/refresh is a later
-- step; C2 only defines the shape + status enum.
CREATE TABLE IF NOT EXISTS connector_grants (
  grant_id       TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  actor_id       TEXT NOT NULL,
  case_space_id  TEXT,
  provider       TEXT NOT NULL,                -- e.g. 'quickbooks', 'drive'
  scopes_json    TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'revoked')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_connector_grants_lookup
  ON connector_grants (tenant_id, actor_id, provider, status);

-- ── source_pointers ──────────────────────────────────────────────────────────
-- Pointers back to the system of record an item/output came from. `system` is
-- free TEXT in C2 (the canonical source-type enum is a V1 definition task per
-- C0); lookups are indexed by case_space and by external id.
CREATE TABLE IF NOT EXISTS source_pointers (
  pointer_id     TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  case_space_id  TEXT,
  item_id        TEXT,
  system         TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  metadata_json  TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_source_pointers_system
  ON source_pointers (tenant_id, case_space_id, system);

CREATE INDEX IF NOT EXISTS idx_source_pointers_external
  ON source_pointers (tenant_id, external_id);
