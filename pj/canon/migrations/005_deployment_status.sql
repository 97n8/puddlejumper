-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 005 — deployment_manifests history + status
-- Source: Phase 4 prompt + Part 14 RESOLVED-3 (overlay deprecation timeline).
--
-- Rebuilds deployment_manifests so a single deployment can have multiple
-- historical rows. The prior schema had UNIQUE(deployment_id), which
-- forced upsert-in-place and lost history. The new schema keeps every
-- manifest version forever (canon: manifests are never deleted) and
-- enforces "exactly one CURRENT per deployment" via a partial unique index.
--
-- This is non-destructive in practice: migration 002 created the table but
-- the codebase had no production writers before Phase 4.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS deployment_manifests;

CREATE TABLE deployment_manifests (
  manifest_id     TEXT PRIMARY KEY,
  deployment_id   TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  manifest_yaml   TEXT NOT NULL,
  manifest_hash   TEXT NOT NULL,
  canon_version   TEXT NOT NULL,
  overlay_name    TEXT NOT NULL,
  overlay_version TEXT NOT NULL,
  declared_at     TEXT NOT NULL,
  declared_by     TEXT NOT NULL,
  loaded_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  status          TEXT NOT NULL DEFAULT 'CURRENT'
                    CHECK (status IN ('CURRENT', 'SUPERSEDED', 'LINT_FAILED'))
);

-- Exactly one CURRENT manifest per deployment; SUPERSEDED rows accumulate.
CREATE UNIQUE INDEX uq_deployment_manifest_current
  ON deployment_manifests (deployment_id)
  WHERE status = 'CURRENT';

CREATE INDEX idx_deployment_manifests_history
  ON deployment_manifests (deployment_id, loaded_at DESC);
