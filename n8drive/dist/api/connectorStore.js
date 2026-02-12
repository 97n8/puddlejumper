import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
function toTokenRecord(row) {
    let scopes = [];
    try {
        const parsed = JSON.parse(row.scopes_json);
        if (Array.isArray(parsed)) {
            scopes = parsed
                .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
                .filter(Boolean);
        }
    }
    catch {
        scopes = [];
    }
    return {
        provider: row.provider,
        tenantId: row.tenant_id,
        userId: row.user_id,
        account: row.account,
        scopes,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
export class ConnectorStore {
    db;
    constructor(dbPath) {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS connector_tokens (
        provider TEXT NOT NULL CHECK(provider IN ('microsoft', 'google', 'github')),
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        account TEXT,
        scopes_json TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (provider, tenant_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS ix_connector_tokens_tenant_user
      ON connector_tokens (tenant_id, user_id);
    `);
    }
    getToken(provider, tenantId, userId) {
        const row = this.db
            .prepare(`
          SELECT
            provider,
            tenant_id,
            user_id,
            account,
            scopes_json,
            access_token,
            refresh_token,
            expires_at,
            created_at,
            updated_at
          FROM connector_tokens
          WHERE provider = ? AND tenant_id = ? AND user_id = ?
          LIMIT 1
        `)
            .get(provider, tenantId, userId);
        if (!row) {
            return null;
        }
        return toTokenRecord(row);
    }
    upsertToken(input) {
        const now = new Date().toISOString();
        const scopesJson = JSON.stringify(Array.from(new Set(input.scopes.map((scope) => scope.trim()).filter(Boolean))));
        this.db
            .prepare(`
          INSERT INTO connector_tokens (
            provider,
            tenant_id,
            user_id,
            account,
            scopes_json,
            access_token,
            refresh_token,
            expires_at,
            created_at,
            updated_at
          )
          VALUES (
            @provider,
            @tenant_id,
            @user_id,
            @account,
            @scopes_json,
            @access_token,
            @refresh_token,
            @expires_at,
            @created_at,
            @updated_at
          )
          ON CONFLICT(provider, tenant_id, user_id) DO UPDATE SET
            account = excluded.account,
            scopes_json = excluded.scopes_json,
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at
        `)
            .run({
            provider: input.provider,
            tenant_id: input.tenantId,
            user_id: input.userId,
            account: input.account,
            scopes_json: scopesJson,
            access_token: input.accessToken,
            refresh_token: input.refreshToken,
            expires_at: input.expiresAt,
            created_at: now,
            updated_at: now
        });
        return this.getToken(input.provider, input.tenantId, input.userId);
    }
    clearToken(provider, tenantId, userId) {
        this.db
            .prepare("DELETE FROM connector_tokens WHERE provider = ? AND tenant_id = ? AND user_id = ?")
            .run(provider, tenantId, userId);
    }
}
