-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 003 — integration (intent dispatch)
-- Source: Master Build Spec v1.1, Part 9 + Part 11.
-- Status: canon reference for fresh deployments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_manifests (
  manifest_id    TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE,
  tenant_id      TEXT NOT NULL,
  manifest_yaml  TEXT NOT NULL,
  webhook_url    TEXT,
  stack          TEXT NOT NULL DEFAULT 'google_workspace',
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS intent_queue (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  tenant_id      TEXT NOT NULL,
  intent         TEXT NOT NULL,
  payload_json   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','dispatched','failed','suppressed')),
  queued_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  dispatched_at  TEXT,
  error_detail   TEXT
);
CREATE INDEX IF NOT EXISTS idx_intent_queue ON intent_queue (user_id, status, queued_at);
