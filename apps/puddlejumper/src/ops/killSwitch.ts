import type Database from "better-sqlite3";

export type KillSwitchState = {
  enabled: boolean;
  reason: string | null;
  setBy: string | null;
  setAt: string | null;
  updatedAt: string;
};

export class KillSwitchStore {
  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS operational_kill_switch (
        scope TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        set_by TEXT,
        set_at TEXT,
        updated_at TEXT NOT NULL
      )
    `);

    const existing = this.db
      .prepare("SELECT scope FROM operational_kill_switch WHERE scope = ?")
      .get("payload_intake") as { scope: string } | undefined;

    if (!existing) {
      this.db
        .prepare(`
          INSERT INTO operational_kill_switch (scope, enabled, reason, set_by, set_at, updated_at)
          VALUES (?, 0, NULL, NULL, NULL, ?)
        `)
        .run("payload_intake", new Date().toISOString());
    }
  }

  read(): KillSwitchState {
    const row = this.db
      .prepare(`
        SELECT enabled, reason, set_by, set_at, updated_at
        FROM operational_kill_switch
        WHERE scope = ?
      `)
      .get("payload_intake") as
      | {
          enabled: number;
          reason: string | null;
          set_by: string | null;
          set_at: string | null;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      throw new Error("Kill switch state missing for payload_intake");
    }

    return {
      enabled: row.enabled === 1,
      reason: row.reason,
      setBy: row.set_by,
      setAt: row.set_at,
      updatedAt: row.updated_at,
    };
  }

  set(input: { enabled: boolean; reason: string | null; setBy: string }): KillSwitchState {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE operational_kill_switch
        SET enabled = ?, reason = ?, set_by = ?, set_at = ?, updated_at = ?
        WHERE scope = ?
      `)
      .run(
        input.enabled ? 1 : 0,
        input.reason,
        input.setBy,
        input.enabled ? now : null,
        now,
        "payload_intake",
      );

    return this.read();
  }

  isEngaged(): boolean {
    return this.read().enabled;
  }
}
