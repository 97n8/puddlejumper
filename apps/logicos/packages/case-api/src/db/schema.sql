PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;

-- 1. migrations
CREATE TABLE IF NOT EXISTS migrations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  version     TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now','utc')),
  checksum    TEXT NOT NULL
);

-- 2. jurisdictions
CREATE TABLE IF NOT EXISTS jurisdictions (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  state             TEXT NOT NULL DEFAULT 'MA',
  slug              TEXT NOT NULL UNIQUE,
  timezone          TEXT NOT NULL DEFAULT 'America/New_York',
  fiscal_year_start TEXT NOT NULL DEFAULT '07-01',
  setup_complete    INTEGER NOT NULL DEFAULT 0,
  config            TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

-- 3. objects
CREATE TABLE IF NOT EXISTS objects (
  id              TEXT PRIMARY KEY,
  jurisdiction_id TEXT NOT NULL REFERENCES jurisdictions(id),
  object_type     TEXT NOT NULL CHECK(object_type IN
    ('actor','body','event','record','workflow','decision','asset')),
  subtype         TEXT NOT NULL,
  owner_id        TEXT REFERENCES objects(id),
  status          TEXT NOT NULL,
  vault_class     TEXT NOT NULL DEFAULT 'unset' CHECK(vault_class IN
    ('public','internal','restricted','privileged','permanent','flagged','unset')),
  retention_class TEXT,
  stage           TEXT CHECK(stage IN
    ('RECEIVES','OPENS','WORKS','DECIDES','RECORDS','NOTIFIES','ARCHIVES','LEARNS')),
  authority_basis TEXT,
  watch_flags     TEXT NOT NULL DEFAULT '[]',
  tags            TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT NOT NULL,
  data            TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_objects_jurisdiction ON objects(jurisdiction_id);
CREATE INDEX idx_objects_type ON objects(object_type);
CREATE INDEX idx_objects_stage ON objects(stage);

-- 4. credentials
CREATE TABLE IF NOT EXISTS credentials (
  id            TEXT PRIMARY KEY,
  object_id     TEXT NOT NULL UNIQUE REFERENCES objects(id),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  auth_method   TEXT NOT NULL DEFAULT 'local'
    CHECK(auth_method IN ('local','m365','google')),
  external_id   TEXT,
  last_login_at TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX idx_credentials_email ON credentials(email);

-- 5. org_config
CREATE TABLE IF NOT EXISTS org_config (
  id                  TEXT PRIMARY KEY,
  jurisdiction_id     TEXT NOT NULL UNIQUE REFERENCES jurisdictions(id),
  setup_step          INTEGER NOT NULL DEFAULT 1,
  town_complete       INTEGER NOT NULL DEFAULT 0,
  identity_complete   INTEGER NOT NULL DEFAULT 0,
  staff_complete      INTEGER NOT NULL DEFAULT 0,
  bodies_complete     INTEGER NOT NULL DEFAULT 0,
  connectors_complete INTEGER NOT NULL DEFAULT 0,
  complete            INTEGER NOT NULL DEFAULT 0,
  connector_token     TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

-- 6. rules
CREATE TABLE IF NOT EXISTS rules (
  id              TEXT PRIMARY KEY,
  jurisdiction_id TEXT REFERENCES jurisdictions(id),
  rule_key        TEXT NOT NULL,
  version         TEXT NOT NULL DEFAULT '1.0.0',
  description     TEXT NOT NULL,
  source_citation TEXT,
  conditions      TEXT NOT NULL DEFAULT '[]',
  actions         TEXT NOT NULL DEFAULT '[]',
  common_catches  TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','active','superseded','archived')),
  published_by    TEXT,
  published_at    TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE(jurisdiction_id, rule_key, version)
);
CREATE INDEX idx_rules_jurisdiction ON rules(jurisdiction_id);
CREATE INDEX idx_rules_status ON rules(status);

-- 7. entities
CREATE TABLE IF NOT EXISTS entities (
  id          TEXT PRIMARY KEY,
  email       TEXT UNIQUE,
  name        TEXT,
  entity_type TEXT NOT NULL DEFAULT 'individual'
    CHECK(entity_type IN ('individual','business','nonprofit','contractor')),
  phone       TEXT,
  address     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 8. entity_sessions
CREATE TABLE IF NOT EXISTS entity_sessions (
  id          TEXT PRIMARY KEY,
  entity_id   TEXT NOT NULL REFERENCES entities(id),
  case_id     TEXT,
  token_hash  TEXT NOT NULL,
  issued_at   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);
CREATE INDEX idx_entity_sessions_entity ON entity_sessions(entity_id);
CREATE INDEX idx_entity_sessions_case   ON entity_sessions(case_id);

-- 9. cases
CREATE TABLE IF NOT EXISTS cases (
  id               TEXT PRIMARY KEY,
  jurisdiction_id  TEXT NOT NULL REFERENCES jurisdictions(id),
  case_number      TEXT NOT NULL,
  case_type        TEXT NOT NULL,
  stage            TEXT NOT NULL DEFAULT 'RECEIVES' CHECK(stage IN
    ('RECEIVES','OPENS','WORKS','DECIDES','RECORDS','NOTIFIES','ARCHIVES','LEARNS')),
  status           TEXT NOT NULL DEFAULT 'open' CHECK(status IN
    ('open','pending_info','under_review','approved','denied','withdrawn','closed')),
  side_a_owner     TEXT REFERENCES objects(id),
  side_b_entity    TEXT REFERENCES entities(id),
  authority_basis  TEXT,
  watch_flags      TEXT NOT NULL DEFAULT '[]',
  description      TEXT,
  address          TEXT,
  parcel_id        TEXT,
  rule_refs        TEXT NOT NULL DEFAULT '[]',
  idempotency_key  TEXT UNIQUE,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_cases_number       ON cases(jurisdiction_id, case_number);
CREATE INDEX        idx_cases_jurisdiction ON cases(jurisdiction_id);
CREATE INDEX        idx_cases_stage        ON cases(stage);
CREATE INDEX        idx_cases_status       ON cases(status);
CREATE INDEX        idx_cases_entity       ON cases(side_b_entity);

-- 10. obligations
CREATE TABLE IF NOT EXISTS obligations (
  id               TEXT PRIMARY KEY,
  case_id          TEXT NOT NULL REFERENCES cases(id),
  rule_id          TEXT REFERENCES rules(id),
  description      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK(status IN
    ('pending','in_progress','fulfilled','waived','overdue')),
  assigned_to      TEXT,
  assigned_side    TEXT NOT NULL CHECK(assigned_side IN ('A','B')),
  due_date         TEXT,
  fulfilled_at     TEXT,
  idempotency_key  TEXT UNIQUE,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX idx_obligations_case   ON obligations(case_id);
CREATE INDEX idx_obligations_status ON obligations(status);

-- 11. submissions
CREATE TABLE IF NOT EXISTS submissions (
  id            TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES cases(id),
  obligation_id TEXT REFERENCES obligations(id),
  form_id       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK(status IN
    ('draft','submitted','under_review','approved','rejected','deficient')),
  submitted_by  TEXT REFERENCES entities(id),
  submitted_at  TEXT,
  reviewed_by   TEXT REFERENCES objects(id),
  reviewed_at   TEXT,
  data          TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX idx_submissions_case ON submissions(case_id);

-- 12. documents
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  case_id       TEXT NOT NULL REFERENCES cases(id),
  submission_id TEXT REFERENCES submissions(id),
  uploaded_by   TEXT NOT NULL,
  uploader_type TEXT NOT NULL CHECK(uploader_type IN ('entity','actor')),
  doc_type      TEXT NOT NULL,
  filename      TEXT NOT NULL,
  checksum      TEXT NOT NULL,
  stored_at     TEXT NOT NULL,
  vault_class   TEXT NOT NULL DEFAULT 'internal',
  created_at    TEXT NOT NULL
);

-- 13. case_actions
CREATE TABLE IF NOT EXISTS case_actions (
  id             TEXT PRIMARY KEY,
  case_id        TEXT NOT NULL REFERENCES cases(id),
  action_type    TEXT NOT NULL,
  performed_by   TEXT NOT NULL,
  performer_type TEXT NOT NULL CHECK(performer_type IN ('actor','entity','system')),
  side           TEXT NOT NULL CHECK(side IN ('A','B','system')),
  description    TEXT,
  metadata       TEXT NOT NULL DEFAULT '{}',
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_case_actions_case ON case_actions(case_id);

-- 14. discovery_queries
CREATE TABLE IF NOT EXISTS discovery_queries (
  id              TEXT PRIMARY KEY,
  jurisdiction_id TEXT REFERENCES jurisdictions(id),
  entity_id       TEXT REFERENCES entities(id),
  raw_query       TEXT NOT NULL,
  address         TEXT,
  parcel_id       TEXT,
  mapped_rules    TEXT NOT NULL DEFAULT '[]',
  answer_summary  TEXT,
  answer_source   TEXT,
  confidence      REAL,
  common_catches  TEXT NOT NULL DEFAULT '[]',
  case_id         TEXT REFERENCES cases(id),
  created_at      TEXT NOT NULL
);

-- 15. seal_entries (WORM)
CREATE TABLE IF NOT EXISTS seal_entries (
  id           TEXT PRIMARY KEY,
  sequence     INTEGER NOT NULL,
  entry_type   TEXT NOT NULL,
  object_id    TEXT NOT NULL,
  actor        TEXT NOT NULL,
  actor_type   TEXT NOT NULL CHECK(actor_type IN ('staff','entity','system','ai')),
  payload_hash TEXT NOT NULL,
  prev_hash    TEXT NOT NULL,
  entry_hash   TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_seal_sequence ON seal_entries(sequence);
CREATE TRIGGER seal_no_update BEFORE UPDATE ON seal_entries BEGIN
  SELECT RAISE(ABORT, 'SEAL entries are immutable');
END;
CREATE TRIGGER seal_no_delete BEFORE DELETE ON seal_entries BEGIN
  SELECT RAISE(ABORT, 'SEAL entries cannot be deleted');
END;

-- 16. pulse_tasks
CREATE TABLE IF NOT EXISTS pulse_tasks (
  id             TEXT PRIMARY KEY,
  case_id        TEXT REFERENCES cases(id),
  obligation_id  TEXT REFERENCES obligations(id),
  task_type      TEXT NOT NULL,
  scheduled_at   TEXT NOT NULL,
  sent_at        TEXT,
  recipient      TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK(recipient_type IN ('entity','actor')),
  channel        TEXT NOT NULL DEFAULT 'email'
    CHECK(channel IN ('email','sms','in_app')),
  status         TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','sent','failed','cancelled')),
  attempt_count  INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_pulse_tasks_scheduled ON pulse_tasks(scheduled_at, status);

-- 17. pulse_dead_letter
CREATE TABLE IF NOT EXISTS pulse_dead_letter (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  case_id         TEXT,
  payload         TEXT NOT NULL,
  failure_reason  TEXT NOT NULL,
  attempt_count   INTEGER NOT NULL DEFAULT 1,
  first_failed_at TEXT NOT NULL,
  last_failed_at  TEXT NOT NULL,
  resolved_at     TEXT
);
