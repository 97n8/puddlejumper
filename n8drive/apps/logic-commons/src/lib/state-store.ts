// ── SQLite-backed OAuth state store (single-use CSRF state with TTL) ────────
//
// Survives server restarts and deploys. Each state token is single-use with
// a 5-minute TTL. Expired rows are pruned on a 60-second interval.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const STATE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PRUNE_INTERVAL_MS = 60 * 1000; // 60 seconds

export class OAuthStateStore {
  private readonly db: Database.Database;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_state (
        state      TEXT PRIMARY KEY,
        provider   TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    // Auto-prune expired rows
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    this.pruneTimer.unref?.();
  }

  /** Create a new state token for the given provider. */
  create(provider: string): string {
    const state = crypto.randomUUID();
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO oauth_state (state, provider, created_at, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(state, provider, now, now + STATE_TTL_MS);
    return state;
  }

  /**
   * Consume a state token (single-use).
   * Returns the provider string if valid and not expired, or `null` otherwise.
   */
  consume(state: string): string | null {
    const row = this.db
      .prepare("SELECT provider, expires_at FROM oauth_state WHERE state = ?")
      .get(state) as { provider: string; expires_at: number } | undefined;

    if (!row) return null;

    // Always delete (single-use)
    this.db.prepare("DELETE FROM oauth_state WHERE state = ?").run(state);

    // Check expiry after deletion so the row is consumed regardless
    if (row.expires_at < Date.now()) return null;

    return row.provider;
  }

  /** Remove all expired state tokens. */
  prune(): number {
    const result = this.db
      .prepare("DELETE FROM oauth_state WHERE expires_at < ?")
      .run(Date.now());
    return result.changes;
  }

  /** Number of active (non-expired) states. Useful for tests/diagnostics. */
  count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM oauth_state WHERE expires_at >= ?")
      .get(Date.now()) as { cnt: number };
    return row.cnt;
  }

  /** Close the database. Call on shutdown or in tests. */
  close(): void {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
    this.db.close();
  }
}
