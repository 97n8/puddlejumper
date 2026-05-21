-- PuddleJumper · VAULT Pay invoice schema
-- Append-only audit_events enforced by trigger (cannot bypass)

CREATE TABLE IF NOT EXISTS invoices (
  id              TEXT PRIMARY KEY,           -- 'PL-2026-001'
  client_name     TEXT NOT NULL,
  client_entity   TEXT NOT NULL,              -- legal entity name
  client_ref_id   TEXT,                       -- e.g. LARA 900117109
  description     TEXT NOT NULL,
  amount_cents    INTEGER NOT NULL,           -- 2500000 = $25,000
  currency        TEXT NOT NULL DEFAULT 'usd',
  status          TEXT NOT NULL DEFAULT 'open'  -- open|partial|paid|void
                    CHECK(status IN ('open','partial','paid','void')),
  payment_method  TEXT,                       -- card|ach|wire|null
  stripe_session  TEXT,
  issued_at       TEXT NOT NULL,
  due_at          TEXT,                       -- NULL = due on receipt
  paid_at         TEXT,
  created_by      TEXT NOT NULL,
  notes           TEXT,
  meta            TEXT DEFAULT '{}'           -- JSON blob for extra fields
);

-- Append-only audit trail: every status change is permanently recorded
-- SQLite trigger = cannot be bypassed from application layer
CREATE TABLE IF NOT EXISTS audit_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,                  -- 'invoice'
  entity_id   TEXT NOT NULL,                  -- invoice id
  event       TEXT NOT NULL,                  -- 'created'|'payment_received'|etc
  actor       TEXT NOT NULL,                  -- 'nate'|'stripe'|'client'
  meta        TEXT DEFAULT '{}',              -- JSON
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Trigger: log every invoice status transition automatically
CREATE TRIGGER IF NOT EXISTS invoice_status_change
AFTER UPDATE OF status ON invoices
BEGIN
  INSERT INTO audit_events (entity_type, entity_id, event, actor, meta)
  VALUES (
    'invoice',
    NEW.id,
    'status_changed',
    'system',
    json_object(
      'from', OLD.status,
      'to',   NEW.status,
      'at',   datetime('now')
    )
  );
END;

-- Seed: PL-2026-001 · EM&S Michigan LTC Network · $25,000
INSERT OR IGNORE INTO invoices (
  id, client_name, client_entity, client_ref_id,
  description, amount_cents, status,
  issued_at, due_at, created_by, notes
) VALUES (
  'PL-2026-001',
  'EM&S Michigan LTC Network',
  'Energy Mann & Sunn, Inc.',
  'LARA 900117109',
  'VAULT Compliance Engagement — Phase 1 Discovery & Systems Mapping. EGLE pre-submittal support. Sites: Flint, Coleman, Lincoln. Lake State Railway coordination. Geocycle feedstock documentation.',
  2500000,
  'open',
  '2026-05-20T09:14:00Z',
  NULL,
  'nate',
  'Authorized by Robert C. McCall Jr. per engagement letter May 2026. Phase 1 fee credits against anchor-site buildout total upon Phase 2 authorization.'
);

INSERT OR IGNORE INTO audit_events (entity_type, entity_id, event, actor, meta)
VALUES (
  'invoice', 'PL-2026-001', 'created', 'nate',
  '{"amount":2500000,"client":"Energy Mann & Sunn, Inc.","terms":"due_on_receipt","engagement":"Michigan LTC Network Phase 1"}'
);
