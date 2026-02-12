import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
const WAIT_FOR_RESULT_MS = 5_000;
const WAIT_INITIAL_DELAY_MS = 100;
const WAIT_MAX_DELAY_MS = 1_000;
export class IdempotencyStore {
    db;
    inFlight = new Map();
    constructor(dbPath) {
        const resolvedPath = path.resolve(dbPath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        this.db = new Database(resolvedPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS idempotency (
        request_id TEXT PRIMARY KEY,
        payload_hash TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        decision_status TEXT,
        decided_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency (expires_at);
      CREATE TABLE IF NOT EXISTS decision_audit (
        request_id TEXT PRIMARY KEY,
        schema_version INTEGER NOT NULL,
        decision_status TEXT NOT NULL,
        approved INTEGER NOT NULL,
        audit_record_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(request_id) REFERENCES idempotency(request_id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_decision_audit_created_at ON decision_audit (created_at);
    `);
        this.ensureColumn("idempotency", "schema_version", "schema_version INTEGER NOT NULL DEFAULT 1");
        this.ensureColumn("idempotency", "decision_status", "decision_status TEXT");
        this.ensureColumn("idempotency", "decided_at", "decided_at TEXT");
    }
    ensureColumn(tableName, columnName, definition) {
        const existingColumns = this.db
            .prepare(`PRAGMA table_info(${tableName})`)
            .all();
        if (!existingColumns.some((column) => column.name === columnName)) {
            this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
        }
    }
    normalizeSchemaVersion(value) {
        const parsed = Number.parseInt(String(value ?? 1), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    createDeferred() {
        let resolveFn = null;
        let rejectFn = null;
        const promise = new Promise((resolve, reject) => {
            resolveFn = resolve;
            rejectFn = reject;
        });
        if (!resolveFn || !rejectFn) {
            throw new Error("Failed to initialize deferred promise");
        }
        return { promise, resolve: resolveFn, reject: rejectFn };
    }
    pruneExpired(nowIso) {
        this.db.prepare("DELETE FROM idempotency WHERE expires_at <= ?").run(nowIso);
        for (const [requestId, inFlight] of this.inFlight.entries()) {
            if (inFlight.expiresAt <= nowIso) {
                inFlight.reject(new Error("Idempotency entry expired before completion"));
                this.inFlight.delete(requestId);
            }
        }
    }
    readRow(requestId) {
        return this.db
            .prepare(`
        SELECT request_id, payload_hash, result_json, created_at, expires_at, schema_version, decision_status, decided_at
        FROM idempotency
        WHERE request_id = ?
      `)
            .get(requestId);
    }
    async waitForCompletedRow(requestId, payloadHash, schemaVersion) {
        const deadline = Date.now() + WAIT_FOR_RESULT_MS;
        let delay = WAIT_INITIAL_DELAY_MS;
        while (Date.now() < deadline) {
            await new Promise((resolve) => {
                setTimeout(resolve, delay);
            });
            const localInFlight = this.inFlight.get(requestId);
            if (localInFlight) {
                if (localInFlight.payloadHash !== payloadHash) {
                    return { type: "conflict" };
                }
                if (localInFlight.schemaVersion !== schemaVersion) {
                    return { type: "schema_mismatch", storedSchemaVersion: localInFlight.schemaVersion };
                }
                return { type: "pending", promise: localInFlight.promise };
            }
            const row = this.readRow(requestId);
            if (!row) {
                return null;
            }
            if (row.payload_hash !== payloadHash) {
                return { type: "conflict" };
            }
            const rowSchemaVersion = this.normalizeSchemaVersion(row.schema_version);
            if (rowSchemaVersion !== schemaVersion) {
                return { type: "schema_mismatch", storedSchemaVersion: rowSchemaVersion };
            }
            if (row.result_json) {
                return { type: "replay", output: JSON.parse(row.result_json) };
            }
            delay = Math.min(delay * 2, WAIT_MAX_DELAY_MS);
        }
        return { type: "conflict" };
    }
    async claim(requestId, payloadHash, nowIso, expiresAtIso, schemaVersion) {
        this.pruneExpired(nowIso);
        const active = this.inFlight.get(requestId);
        if (active) {
            if (active.payloadHash !== payloadHash) {
                return { type: "conflict" };
            }
            if (active.schemaVersion !== schemaVersion) {
                return { type: "schema_mismatch", storedSchemaVersion: active.schemaVersion };
            }
            return { type: "pending", promise: active.promise };
        }
        const existingRow = this.readRow(requestId);
        if (existingRow?.payload_hash && existingRow.payload_hash !== payloadHash) {
            return { type: "conflict" };
        }
        if (existingRow) {
            const existingSchemaVersion = this.normalizeSchemaVersion(existingRow.schema_version);
            if (existingSchemaVersion !== schemaVersion) {
                return { type: "schema_mismatch", storedSchemaVersion: existingSchemaVersion };
            }
            if (existingRow.result_json) {
                return { type: "replay", output: JSON.parse(existingRow.result_json) };
            }
            const pendingResult = await this.waitForCompletedRow(requestId, payloadHash, schemaVersion);
            if (pendingResult) {
                return pendingResult;
            }
        }
        const insert = this.db.prepare(`
      INSERT OR IGNORE INTO idempotency (request_id, payload_hash, result_json, created_at, expires_at, schema_version, decision_status, decided_at)
      VALUES (?, ?, NULL, ?, ?, ?, 'pending', NULL)
    `);
        const inserted = insert.run(requestId, payloadHash, nowIso, expiresAtIso, schemaVersion);
        if (inserted.changes !== 1) {
            const rowAfterInsert = this.readRow(requestId);
            if (!rowAfterInsert) {
                return { type: "conflict" };
            }
            if (rowAfterInsert.payload_hash !== payloadHash) {
                return { type: "conflict" };
            }
            const rowSchemaVersion = this.normalizeSchemaVersion(rowAfterInsert.schema_version);
            if (rowSchemaVersion !== schemaVersion) {
                return { type: "schema_mismatch", storedSchemaVersion: rowSchemaVersion };
            }
            if (rowAfterInsert.result_json) {
                return { type: "replay", output: JSON.parse(rowAfterInsert.result_json) };
            }
            const pendingResult = await this.waitForCompletedRow(requestId, payloadHash, schemaVersion);
            if (pendingResult) {
                return pendingResult;
            }
            return { type: "conflict" };
        }
        const deferred = this.createDeferred();
        this.inFlight.set(requestId, {
            payloadHash,
            schemaVersion,
            promise: deferred.promise,
            resolve: deferred.resolve,
            reject: deferred.reject,
            expiresAt: expiresAtIso
        });
        return { type: "acquired" };
    }
    storeResult(requestId, output, schemaVersion, decisionStatus, auditRecord, nowIso = new Date().toISOString()) {
        const resultJson = JSON.stringify(output);
        const auditRecordJson = JSON.stringify(auditRecord);
        const approved = decisionStatus === "approved" ? 1 : 0;
        const persist = this.db.transaction(() => {
            const updated = this.db
                .prepare("UPDATE idempotency SET result_json = ?, schema_version = ?, decision_status = ?, decided_at = ? WHERE request_id = ?")
                .run(resultJson, schemaVersion, decisionStatus, nowIso, requestId);
            if (updated.changes !== 1) {
                throw new Error("Failed to persist idempotency decision");
            }
            this.db
                .prepare(`
          INSERT OR REPLACE INTO decision_audit
            (request_id, schema_version, decision_status, approved, audit_record_json, result_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
                .run(requestId, schemaVersion, decisionStatus, approved, auditRecordJson, resultJson, nowIso);
        });
        persist();
        const pending = this.inFlight.get(requestId);
        if (pending) {
            pending.resolve(output);
            this.inFlight.delete(requestId);
        }
    }
    abandon(requestId) {
        this.db.prepare("DELETE FROM idempotency WHERE request_id = ?").run(requestId);
        const pending = this.inFlight.get(requestId);
        if (pending) {
            pending.reject(new Error("Idempotency request failed before completion"));
            this.inFlight.delete(requestId);
        }
    }
    close() {
        for (const pending of this.inFlight.values()) {
            pending.reject(new Error("Idempotency store closed"));
        }
        this.inFlight.clear();
        this.db.close();
    }
}
