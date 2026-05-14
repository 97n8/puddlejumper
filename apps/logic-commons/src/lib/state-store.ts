// ── SQLite-backed OAuth state store (single-use CSRF state with TTL) ────────
//
// Survives server restarts and deploys. Each state token is single-use with
// a 5-minute TTL. Expired rows are pruned on a 60-second interval.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes (extended for real-world OAuth delays)
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
        state         TEXT PRIMARY KEY,
        provider      TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        expires_at    INTEGER NOT NULL,
        used          INTEGER NOT NULL DEFAULT 0,
        code_verifier TEXT
      )
    `);

    // Migrate existing tables that lack the 'used' column
    const cols = this.db.pragma("table_info(oauth_state)") as { name: string }[];
    if (!cols.some((c) => c.name === "used")) {
      this.db.exec("ALTER TABLE oauth_state ADD COLUMN used INTEGER NOT NULL DEFAULT 0");
    }
    
    // Migrate existing tables that lack the 'code_verifier' column (for PKCE support)
    if (!cols.some((c) => c.name === "code_verifier")) {
      this.db.exec("ALTER TABLE oauth_state ADD COLUMN code_verifier TEXT");
    }

    // Auto-prune expired rows
    this.pruneTimer = setInterval(() => this.prune(), PRUNE_INTERVAL_MS);
    this.pruneTimer.unref?.();
  }

  /** Create a new state token for the given provider, optionally with PKCE code_verifier. */
  create(provider: string, codeVerifier?: string): string {
    const state = crypto.randomUUID();
    const now = Date.now();
    this.db
      .prepare(
        "INSERT INTO oauth_state (state, provider, created_at, expires_at, code_verifier) VALUES (?, ?, ?, ?, ?)",
      )
      .run(state, provider, now, now + STATE_TTL_MS, codeVerifier || null);
    return state;
  }

  /**
   * Consume a state token (single-use, atomic).
   * Uses UPDATE ... WHERE used=0 AND expires_at > now for atomic CAS.
   * Returns an object with provider and code_verifier (if PKCE was used),
   * or `null` if it doesn't exist, was already consumed, or has expired.
   */
  consume(state: string): { provider: string; codeVerifier?: string } | null {
    const now = Date.now();

    // Atomic single-use: only marks as used if not already used and not expired
    const result = this.db
      .prepare("UPDATE oauth_state SET used = 1 WHERE state = ? AND used = 0 AND expires_at > ?")
      .run(state, now);

    if (result.changes === 0) return null;

    // Fetch the provider and code_verifier after successful CAS
    const row = this.db
      .prepare("SELECT provider, code_verifier FROM oauth_state WHERE state = ?")
      .get(state) as { provider: string; code_verifier: string | null } | undefined;

    if (!row) return null;

    return {
      provider: row.provider,
      codeVerifier: row.code_verifier || undefined,
    };
  }

  /** Remove all expired or already-used state tokens. */
  prune(): number {
    const result = this.db
      .prepare("DELETE FROM oauth_state WHERE expires_at < ? OR used = 1")
      .run(Date.now());
    return result.changes;
  }

  /** Number of active (non-expired, non-used) states. Useful for tests/diagnostics. */
  count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as cnt FROM oauth_state WHERE expires_at >= ? AND used = 0")
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
