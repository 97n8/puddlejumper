-- ─────────────────────────────────────────────────────────────────────────────
-- PuddleJumper canon migration 004 — shared binding registry (Part 14 RESOLVED-2)
-- Source: Master Build Spec v1.1, Part 14 + Phase 4 prompt.
--
-- shared_bindings holds reusable, versioned binding artifacts that overlays
-- can reference by artifact_id instead of duplicating content. Once
-- published, content is immutable — the trigger below enforces this at the
-- DB level. The only mutation allowed on an existing row is setting
-- `deprecated_at`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shared_bindings (
  binding_id     TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  split_point    TEXT NOT NULL,
  version        TEXT NOT NULL,
  content_yaml   TEXT NOT NULL,
  content_hash   TEXT NOT NULL,
  published_by   TEXT NOT NULL,
  published_at   TEXT NOT NULL,
  deprecated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_shared_bindings_split
  ON shared_bindings (split_point, deprecated_at);

-- Canon trigger — content is immutable. Allows deprecation (deprecated_at
-- mutation) but refuses any change to content_yaml or content_hash.
CREATE TRIGGER IF NOT EXISTS shared_bindings_no_content_update
BEFORE UPDATE ON shared_bindings
WHEN OLD.content_yaml IS NOT NEW.content_yaml
  OR OLD.content_hash IS NOT NEW.content_hash
  OR OLD.binding_id   IS NOT NEW.binding_id
BEGIN
  SELECT RAISE(ABORT, 'shared_bindings content is immutable (canon)');
END;
