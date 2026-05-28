PRAGMA foreign_keys = ON;

BEGIN;

CREATE TABLE IF NOT EXISTS civic_actors (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS logicos_records (
  id TEXT PRIMARY KEY,
  area TEXT NOT NULL CHECK (area IN ('PL', 'PI', 'CAM', 'LIFE', 'LAB')),
  sequence_year INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
  created_by_actor_id TEXT REFERENCES civic_actors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  owner_actor_id TEXT REFERENCES civic_actors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  collaborator_actor_id TEXT REFERENCES civic_actors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  owner_label TEXT,
  collaborator_label TEXT,
  home_provider TEXT CHECK (home_provider IN ('google', 'microsoft', 'github')),
  destination_provider TEXT NOT NULL CHECK (destination_provider IN ('google', 'microsoft', 'github')),
  connector_mode TEXT NOT NULL CHECK (connector_mode IN ('google-folder', 'placeholder')),
  primary_link TEXT,
  google_link TEXT,
  m365_link TEXT,
  github_link TEXT,
  next_action TEXT,
  due_date TEXT,
  notes TEXT,
  source TEXT NOT NULL,
  google_parent_id TEXT,
  routing_state TEXT NOT NULL CHECK (routing_state IN ('pending', 'selected', 'completed', 'failed', 'placeholder')),
  connector_state TEXT NOT NULL CHECK (connector_state IN ('idle', 'started', 'completed', 'failed', 'placeholder')),
  last_error TEXT,
  external_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (area, sequence_year, sequence_number)
) STRICT;

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES logicos_records(id) ON UPDATE RESTRICT ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('record_created', 'route_selected', 'connector_started', 'connector_completed', 'connector_failed')),
  actor_id TEXT REFERENCES civic_actors(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  actor_source TEXT NOT NULL,
  actor_ip TEXT,
  actor_user_agent TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS id_sequence (
  area TEXT NOT NULL,
  sequence_year INTEGER NOT NULL,
  last_value INTEGER NOT NULL CHECK (last_value >= 0),
  PRIMARY KEY (area, sequence_year)
) STRICT;

CREATE TABLE IF NOT EXISTS logicos_routing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT NOT NULL CHECK (area IN ('PL', 'PI', 'CAM', 'LIFE', 'LAB')),
  requested_home TEXT CHECK (requested_home IN ('google', 'microsoft', 'github')),
  destination_provider TEXT NOT NULL CHECK (destination_provider IN ('google', 'microsoft', 'github')),
  home_provider TEXT NOT NULL CHECK (home_provider IN ('google', 'microsoft', 'github')),
  connector_mode TEXT NOT NULL CHECK (connector_mode IN ('google-folder', 'placeholder')),
  reason TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_logicos_routing_unique
  ON logicos_routing(area, COALESCE(requested_home, 'default'));

CREATE INDEX IF NOT EXISTS idx_logicos_records_area_status
  ON logicos_records(area, status);

CREATE INDEX IF NOT EXISTS idx_logicos_records_destination
  ON logicos_records(destination_provider, routing_state, connector_state);

CREATE INDEX IF NOT EXISTS idx_audit_events_record_created_at
  ON audit_events(record_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

INSERT OR IGNORE INTO logicos_routing (
  area,
  requested_home,
  destination_provider,
  home_provider,
  connector_mode,
  reason,
  sort_order,
  is_active
) VALUES
  ('PL',   NULL,     'microsoft', 'microsoft', 'placeholder',   'PL records are reserved for the Microsoft 365 connector.', 100, 1),
  ('PI',   NULL,     'microsoft', 'microsoft', 'placeholder',   'PI defaults to Microsoft 365 until a Google-specific PI flow is added.', 100, 1),
  ('PI',   'google', 'google',    'google',    'placeholder',   'PI can target Google, but the first working connector is limited to CAM/LIFE.', 10, 1),
  ('CAM',  NULL,     'google',    'google',    'google-folder', 'CAM records route to the Google Drive connector.', 100, 1),
  ('LIFE', NULL,     'google',    'google',    'google-folder', 'LIFE records route to the Google Drive connector.', 100, 1),
  ('LAB',  NULL,     'github',    'github',    'placeholder',   'LAB records are reserved for the GitHub connector.', 100, 1);

COMMIT;
