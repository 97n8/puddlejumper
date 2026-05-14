import type Database from 'better-sqlite3';

export function runStayOSMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stayos_properties (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'MA',
      zip TEXT NOT NULL,
      unit_count INTEGER NOT NULL DEFAULT 1,
      check_in_time TEXT NOT NULL DEFAULT '15:00',
      check_out_time TEXT NOT NULL DEFAULT '11:00',
      wifi_name TEXT,
      wifi_password TEXT,
      door_code TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_reservations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      property_id TEXT NOT NULL REFERENCES stayos_properties(id) ON DELETE CASCADE,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      check_in DATE NOT NULL,
      check_out DATE NOT NULL,
      guests_count INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'direct',
      status TEXT NOT NULL DEFAULT 'confirmed',
      total_amount REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_devices (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      property_id TEXT NOT NULL REFERENCES stayos_properties(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      device_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      device_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      last_seen_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_device_tokens (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_automations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      property_id TEXT REFERENCES stayos_properties(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      trigger TEXT NOT NULL,
      trigger_offset_hours INTEGER,
      action TEXT NOT NULL,
      action_config TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_automation_queue (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      automation_id TEXT NOT NULL REFERENCES stayos_automations(id) ON DELETE CASCADE,
      reservation_id TEXT REFERENCES stayos_reservations(id) ON DELETE CASCADE,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      ran_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_tasks (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      property_id TEXT REFERENCES stayos_properties(id) ON DELETE CASCADE,
      reservation_id TEXT REFERENCES stayos_reservations(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      notes TEXT,
      assigned_to TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      due_date DATE,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_messages (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      reservation_id TEXT REFERENCES stayos_reservations(id) ON DELETE CASCADE,
      direction TEXT NOT NULL,
      channel TEXT NOT NULL,
      to_address TEXT NOT NULL,
      from_address TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      external_id TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_message_templates (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      trigger TEXT,
      channel TEXT NOT NULL DEFAULT 'sms',
      subject TEXT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stayos_audit_log (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      changes TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS stayos_audit_no_update BEFORE UPDATE ON stayos_audit_log
    BEGIN SELECT RAISE(ABORT, 'stayos_audit_log is append-only'); END;

    CREATE TRIGGER IF NOT EXISTS stayos_audit_no_delete BEFORE DELETE ON stayos_audit_log
    BEGIN SELECT RAISE(ABORT, 'stayos_audit_log is append-only'); END;

    CREATE TABLE IF NOT EXISTS stayos_intake_submissions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      property_slug TEXT NOT NULL,
      guest_name TEXT NOT NULL,
      guest_email TEXT NOT NULL,
      guest_phone TEXT,
      check_in DATE,
      check_out DATE,
      guests_count INTEGER DEFAULT 1,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function seedDefaultTemplates(db: Database.Database, workspaceId: string): void {
  // No-op — generic placeholder templates removed.
  // Real templates are seeded via POST /api/stayos/seed/kendall-pond.
  void db; void workspaceId;
}
