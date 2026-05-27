// @pj/db — SQLite layer + canon append-only audit writer.
// See: Master Build Spec v1.1, Part 7 (@pj/db) and Part 11 (canon schema).

export { getDb, migrate, verifyAuditTriggers } from './db.js';
export type { DatabaseHandle, MigrateResult } from './db.js';

export { appendAuditEvent } from './audit.js';
export type { AppendAuditEventInput } from './audit.js';
