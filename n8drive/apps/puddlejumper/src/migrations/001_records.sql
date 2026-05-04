-- 001_records.sql
-- ============================================================================
-- LogicOS V1 Spine — records table
--
-- This is the canonical table for every captured record in the system.
-- Created at:    pj.publiclogic.org (PuddleJumper backend)
-- Path:          /src/migrations/001_records.sql
--
-- Notes:
--   - `home` is set once at creation by the router and is never changed.
--     Existing records reflect the routing rule that was in effect at their
--     creation time. This preserves audit-trail truth. The application layer
--     enforces this via PATCH field whitelist; a hardening trigger is
--     deferred to V2.
--   - `collaborators` is a JSON array of user_ids, validated at the DB level.
--     When PI volume grows, migrate to a join table. Not before.
--   - `lastError` is JSON with shape {code, message, retryable}. Strict
--     structure is enforced in the application layer, not here.
--   - `connectorState` and `status` are intentionally distinct enums.
--     status = your judgment about the work.
--     connectorState = the system's report of what it actually did.
--     They never collapse into each other.
-- ============================================================================

CREATE TABLE IF NOT EXISTS records (
  id              TEXT PRIMARY KEY,                -- AREA-YEAR-NNN format
  title           TEXT NOT NULL,
  area            TEXT NOT NULL CHECK(area IN ('PL', 'PI', 'CAM', 'LIFE', 'LAB')),
  status          TEXT NOT NULL DEFAULT 'idea'
                    CHECK(status IN ('idea', 'active', 'waiting', 'done', 'archived')),

  owner           TEXT NOT NULL,                   -- user_id (UUID)
  collaborators   TEXT NOT NULL DEFAULT '[]'
                    CHECK(json_valid(collaborators)),

  home            TEXT NOT NULL CHECK(home IN ('google', 'm365', 'github')),
  destination     TEXT,                            -- folder | doc | issue | repo

  primary_link    TEXT,
  google_link     TEXT,
  m365_link       TEXT,
  github_link     TEXT,

  next_action     TEXT,
  due_date        TEXT,                            -- ISO 8601 date
  notes           TEXT,
  source          TEXT CHECK(source IN ('shortcut', 'web', 'email', 'manual') OR source IS NULL),

  routing_state   TEXT NOT NULL DEFAULT 'pending'
                    CHECK(routing_state IN ('pending', 'routed', 'failed')),
  connector_state TEXT NOT NULL DEFAULT 'not_started'
                    CHECK(connector_state IN ('not_started', 'queued', 'running', 'completed', 'failed')),
  last_error      TEXT CHECK(last_error IS NULL OR json_valid(last_error)),

  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Sequence table backing the ID generator. One row per (area, year).
-- The ID generator increments `seq` atomically inside a transaction.
CREATE TABLE IF NOT EXISTS id_sequence (
  area      TEXT NOT NULL,
  year      INTEGER NOT NULL,
  seq       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (area, year)
);

-- Indexes for common query paths.
CREATE INDEX IF NOT EXISTS idx_records_area_year     ON records(area, created_at);
CREATE INDEX IF NOT EXISTS idx_records_status        ON records(status);
CREATE INDEX IF NOT EXISTS idx_records_owner         ON records(owner);
CREATE INDEX IF NOT EXISTS idx_records_connector     ON records(connector_state)
  WHERE connector_state IN ('queued', 'running', 'failed');

-- Touch updated_at on every UPDATE.
CREATE TRIGGER IF NOT EXISTS records_updated_at
  AFTER UPDATE ON records
  FOR EACH ROW
  WHEN OLD.updated_at = NEW.updated_at
BEGIN
  UPDATE records SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
