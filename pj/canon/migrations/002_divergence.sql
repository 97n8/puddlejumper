-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 002 — divergence (Split-Row Runtime Contract)
-- Source: Master Build Spec v1.1, Part 11 + Part 5 (Split-Row Runtime Contract).
-- Status: canon reference for fresh deployments.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deployment_manifests (
  manifest_id     TEXT PRIMARY KEY,
  deployment_id   TEXT NOT NULL UNIQUE,
  tenant_id       TEXT NOT NULL,
  manifest_yaml   TEXT NOT NULL,
  manifest_hash   TEXT NOT NULL,
  canon_version   TEXT NOT NULL,
  overlay_name    TEXT NOT NULL,
  overlay_version TEXT NOT NULL,
  declared_at     TEXT NOT NULL,
  declared_by     TEXT NOT NULL,
  loaded_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
