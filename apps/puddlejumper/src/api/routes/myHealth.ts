// ── My Health App — PuddleJumper API ─────────────────────────────────────────
//
// Ingests Apple Health data via Health Auto Export (HAE) REST automations and
// exposes query + privacy management endpoints for the LogicOS My Health UI.
//
// Ingest:
//   POST /api/v1/my-health/ingest/hae          — HAE automation push (token auth)
//   POST /api/v1/my-health/ingest/manual        — Manual JSON/CSV upload (session auth)
//
// Token management:
//   POST /api/v1/my-health/tokens               — Create ingest token
//   POST /api/v1/my-health/tokens/:id/revoke    — Revoke token
//   GET  /api/v1/my-health/tokens               — List tokens (prefix + status only)
//
// Query:
//   GET  /api/v1/my-health/metrics              — Daily aggregates (steps, HR, sleep, …)
//   GET  /api/v1/my-health/workouts             — Workout summaries
//   GET  /api/v1/my-health/sources              — Connected sources (HAE automations)
//   GET  /api/v1/my-health/status               — Last ingest timestamp per source
//
// Privacy:
//   GET  /api/v1/my-health/consent              — Active consent receipt
//   POST /api/v1/my-health/consent              — Create / update consent
//   GET  /api/v1/my-health/export               — Export all data as JSON
//   DELETE /api/v1/my-health/data               — Delete all health data + receipts

import express from "express";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";
import { z } from "zod";

// ── DB schema ─────────────────────────────────────────────────────────────────

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mh_sources (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  source_type   TEXT NOT NULL CHECK (source_type IN ('hae_rest','manual_import')),
  display_name  TEXT,
  automation_id TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  last_ingest   TEXT
);

CREATE TABLE IF NOT EXISTS mh_ingest_tokens (
  id               TEXT PRIMARY KEY,
  workspace_id     TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  token_prefix     TEXT NOT NULL,
  token_hash       TEXT NOT NULL,
  label            TEXT,
  created_at       TEXT NOT NULL,
  revoked_at       TEXT,
  last_used_at     TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS mh_tokens_hash_uq ON mh_ingest_tokens(token_hash);

CREATE TABLE IF NOT EXISTS mh_ingest_receipts (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  automation_id TEXT,
  session_id    TEXT,
  received_at   TEXT NOT NULL,
  payload_hash  TEXT NOT NULL,
  parse_status  TEXT NOT NULL CHECK (parse_status IN ('accepted','deduped','rejected')),
  record_count  INTEGER DEFAULT 0,
  error_code    TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS mh_receipts_dedupe_uq
  ON mh_ingest_receipts(source_id, session_id, payload_hash);

CREATE TABLE IF NOT EXISTS mh_samples (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  metric_key      TEXT NOT NULL,
  unit            TEXT,
  start_time_utc  TEXT NOT NULL,
  end_time_utc    TEXT,
  value_num       REAL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mh_samples_idx
  ON mh_samples(workspace_id, user_id, metric_key, start_time_utc);

CREATE TABLE IF NOT EXISTS mh_workouts (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  source_id       TEXT NOT NULL,
  workout_type    TEXT NOT NULL,
  start_time_utc  TEXT NOT NULL,
  end_time_utc    TEXT NOT NULL,
  duration_sec    INTEGER,
  energy_kcal     REAL,
  distance_m      REAL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mh_workouts_idx
  ON mh_workouts(workspace_id, user_id, start_time_utc);

CREATE TABLE IF NOT EXISTS mh_daily_aggregates (
  workspace_id  TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  metric_key    TEXT NOT NULL,
  day_utc       TEXT NOT NULL,
  unit          TEXT,
  sum_value     REAL,
  avg_value     REAL,
  min_value     REAL,
  max_value     REAL,
  sample_count  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, user_id, metric_key, day_utc)
);

CREATE TABLE IF NOT EXISTS mh_consent_receipts (
  id              TEXT PRIMARY KEY,
  workspace_id    TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  purpose         TEXT NOT NULL DEFAULT 'personal_wellness',
  categories_json TEXT NOT NULL,
  accepted_at     TEXT NOT NULL,
  revoked_at      TEXT
);
CREATE INDEX IF NOT EXISTS mh_consent_idx
  ON mh_consent_receipts(workspace_id, user_id, accepted_at);
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() { return crypto.randomUUID() }
function now()  { return new Date().toISOString() }

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

function sha256Json(obj: unknown): string {
  const s = JSON.stringify(obj, Object.keys(obj as object).sort())
  return crypto.createHash("sha256").update(s).digest("hex")
}

function resolveUserId(auth: { userId?: string; tenantId?: string; sub?: string }): string {
  return (auth as any).userId ?? (auth as any).sub ?? "anonymous"
}

function resolveWorkspaceId(auth: { tenantId?: string }): string {
  return auth.tenantId ?? "default"
}

// ── Token auth (for HAE automation) ──────────────────────────────────────────

function verifyIngestToken(
  db: Database.Database,
  rawToken: string
): { workspaceId: string; userId: string; tokenId: string } | null {
  const hash = hashToken(rawToken)
  const row = db.prepare(`
    SELECT id, workspace_id, user_id, revoked_at FROM mh_ingest_tokens
    WHERE token_hash = ?
  `).get(hash) as any
  if (!row || row.revoked_at) return null
  db.prepare(`UPDATE mh_ingest_tokens SET last_used_at = ? WHERE id = ?`).run(now(), row.id)
  return { workspaceId: row.workspace_id, userId: row.user_id, tokenId: row.id }
}

function extractToken(req: express.Request): string | null {
  const auth = req.headers["authorization"]
  if (auth?.startsWith("Bearer ")) return auth.slice(7)
  const key = req.headers["x-api-key"]
  if (typeof key === "string") return key
  return null
}

// ── Ingest normalizer ─────────────────────────────────────────────────────────

interface HaeMetricEntry { start: string; end?: string; qty?: number; Avg?: number; value?: number }
interface HaeMetric { name: string; unit?: string; data: HaeMetricEntry[] }
interface HaeWorkout {
  name: string
  start: string
  end: string
  duration?: number
  activeEnergy?: { qty: number }
  distance?: { qty: number; unit?: string }
}
interface HaePayload {
  data: {
    metrics?: HaeMetric[]
    workouts?: HaeWorkout[]
  }
}

function normalizeMetricKey(name: string): string {
  // HAE uses camelCase names that we store as-is for simplicity
  return name.toLowerCase().replace(/\s+/g, "_")
}

function ingestHaePayload(
  db: Database.Database,
  payload: HaePayload,
  workspaceId: string,
  userId: string,
  sourceId: string
): number {
  let count = 0
  const insertSample = db.prepare(`
    INSERT OR IGNORE INTO mh_samples (id, workspace_id, user_id, source_id, metric_key, unit, start_time_utc, end_time_utc, value_num, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertWorkout = db.prepare(`
    INSERT OR IGNORE INTO mh_workouts (id, workspace_id, user_id, source_id, workout_type, start_time_utc, end_time_utc, duration_sec, energy_kcal, distance_m, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const upsertAgg = db.prepare(`
    INSERT INTO mh_daily_aggregates (workspace_id, user_id, metric_key, day_utc, unit, sum_value, avg_value, min_value, max_value, sample_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(workspace_id, user_id, metric_key, day_utc) DO UPDATE SET
      sum_value    = COALESCE(sum_value, 0) + excluded.sum_value,
      min_value    = MIN(COALESCE(min_value, excluded.min_value), excluded.min_value),
      max_value    = MAX(COALESCE(max_value, 0), excluded.max_value),
      sample_count = sample_count + 1,
      avg_value    = (COALESCE(sum_value, 0) + excluded.sum_value) / (sample_count + 1)
  `)

  const ingestTx = db.transaction(() => {
    for (const metric of payload.data?.metrics ?? []) {
      const key = normalizeMetricKey(metric.name)
      for (const entry of metric.data ?? []) {
        const val = entry.qty ?? entry.Avg ?? entry.value
        if (val == null) continue
        const day = entry.start.slice(0, 10)
        insertSample.run(uuid(), workspaceId, userId, sourceId, key, metric.unit ?? null, entry.start, entry.end ?? null, val, now())
        upsertAgg.run(workspaceId, userId, key, day, metric.unit ?? null, val, val, val, val)
        count++
      }
    }
    for (const workout of payload.data?.workouts ?? []) {
      const durSec = workout.duration ?? null
      const kcal = workout.activeEnergy?.qty ?? null
      const dist = workout.distance?.qty != null
        ? workout.distance.qty * (workout.distance.unit === "km" ? 1000 : 1)
        : null
      insertWorkout.run(uuid(), workspaceId, userId, sourceId, workout.name, workout.start, workout.end, durSec, kcal, dist, now())
      count++
    }
  })
  ingestTx()
  return count
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const HaePayloadSchema = z.object({
  data: z.object({
    metrics:     z.array(z.object({ name: z.string(), unit: z.string().optional(), data: z.array(z.record(z.string(), z.unknown())) })).optional().default([]),
    workouts:    z.array(z.record(z.string(), z.unknown())).optional().default([]),
    stateOfMind: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }),
})

const CreateTokenSchema  = z.object({ label: z.string().max(80).optional() })
const ConsentSchema      = z.object({ categories: z.array(z.string()).min(1), purpose: z.string().optional() })

// ── Router factory ────────────────────────────────────────────────────────────

export function createMyHealthRoutes(db: Database.Database): express.Router {
  // Ensure schema exists
  db.exec(SCHEMA)

  const router = express.Router()

  // ── Ingest (HAE token auth) ───────────────────────────────────────────────

  router.post("/v1/my-health/ingest/hae", express.json({ limit: "10mb" }), async (req, res) => {
    const rawToken = extractToken(req)
    if (!rawToken) { res.status(401).json({ error: "missing_ingest_token" }); return }

    const scope = verifyIngestToken(db, rawToken)
    if (!scope) { res.status(401).json({ error: "invalid_or_revoked_token" }); return }

    const automationId = String(req.headers["automation-id"] ?? "")
    const sessionId    = String(req.headers["session-id"]    ?? uuid())

    const parsed = HaePayloadSchema.safeParse(req.body)
    if (!parsed.success) { res.status(400).json({ error: "invalid_payload", issues: parsed.error.issues }); return }

    const payloadHash = sha256Json(parsed.data)

    // Get or create source record for this automation
    let source = db.prepare(`SELECT id FROM mh_sources WHERE workspace_id = ? AND user_id = ? AND automation_id = ?`).get(scope.workspaceId, scope.userId, automationId) as any
    if (!source) {
      const sid = uuid()
      db.prepare(`INSERT INTO mh_sources (id, workspace_id, user_id, source_type, display_name, automation_id, created_at, updated_at) VALUES (?, ?, ?, 'hae_rest', ?, ?, ?, ?)`).run(sid, scope.workspaceId, scope.userId, automationId || "Health Auto Export", automationId, now(), now())
      source = { id: sid }
    }

    // Deduplication check
    const existing = db.prepare(`SELECT id, parse_status FROM mh_ingest_receipts WHERE source_id = ? AND session_id = ? AND payload_hash = ?`).get(source.id, sessionId, payloadHash) as any
    if (existing) {
      res.json({ receiptId: existing.id, status: "deduped", payloadHash })
      return
    }

    const receiptId = `ing_${uuid()}`
    let recordCount = 0
    try {
      recordCount = ingestHaePayload(db, parsed.data as unknown as HaePayload, scope.workspaceId, scope.userId, source.id)
      db.prepare(`INSERT OR IGNORE INTO mh_ingest_receipts (id, workspace_id, user_id, source_id, automation_id, session_id, received_at, payload_hash, parse_status, record_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'accepted', ?)`).run(receiptId, scope.workspaceId, scope.userId, source.id, automationId, sessionId, now(), payloadHash, recordCount)
      db.prepare(`UPDATE mh_sources SET last_ingest = ?, updated_at = ? WHERE id = ?`).run(now(), now(), source.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      db.prepare(`INSERT OR IGNORE INTO mh_ingest_receipts (id, workspace_id, user_id, source_id, automation_id, session_id, received_at, payload_hash, parse_status, error_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rejected', ?)`).run(receiptId, scope.workspaceId, scope.userId, source.id, automationId, sessionId, now(), payloadHash, msg.slice(0, 200))
      res.status(500).json({ error: "ingest_failed", detail: msg }); return
    }

    res.status(202).json({ receiptId, status: "accepted", payloadHash, automationId, sessionId, recordCount })
  })

  // ── Token management (session auth) ──────────────────────────────────────

  router.get("/v1/my-health/tokens", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)
    const rows = db.prepare(`SELECT id, token_prefix, label, created_at, revoked_at, last_used_at FROM mh_ingest_tokens WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC`).all(wid, uid)
    res.json({ tokens: rows })
  })

  router.post("/v1/my-health/tokens", express.json(), (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)

    const parsed = CreateTokenSchema.safeParse(req.body ?? {})
    if (!parsed.success) { res.status(400).json({ error: "invalid_body" }); return }

    const rawToken  = `mh_${crypto.randomBytes(32).toString("base64url")}`
    const prefix    = rawToken.slice(0, 8)
    const tokenId   = uuid()
    const tokenHash = hashToken(rawToken)

    db.prepare(`INSERT INTO mh_ingest_tokens (id, workspace_id, user_id, token_prefix, token_hash, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(tokenId, wid, uid, prefix, tokenHash, parsed.data.label ?? null, now())

    res.status(201).json({ tokenId, tokenPrefix: prefix, token: rawToken, createdAt: now(), note: "Token shown once — store it securely." })
  })

  router.post("/v1/my-health/tokens/:id/revoke", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)
    const row = db.prepare(`SELECT id FROM mh_ingest_tokens WHERE id = ? AND workspace_id = ? AND user_id = ? AND revoked_at IS NULL`).get(req.params.id, wid, uid) as any
    if (!row) { res.status(404).json({ error: "not_found_or_already_revoked" }); return }
    const revokedAt = now()
    db.prepare(`UPDATE mh_ingest_tokens SET revoked_at = ? WHERE id = ?`).run(revokedAt, row.id)
    res.json({ ok: true, revokedAt })
  })

  // ── Query endpoints (session auth) ────────────────────────────────────────

  router.get("/v1/my-health/sources", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)
    const rows = db.prepare(`SELECT id, source_type, display_name, automation_id, created_at, last_ingest FROM mh_sources WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC`).all(wid, uid)
    res.json({ sources: rows })
  })

  router.get("/v1/my-health/status", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)
    const lastIngest = db.prepare(`SELECT MAX(received_at) AS last_ingest FROM mh_ingest_receipts WHERE workspace_id = ? AND user_id = ? AND parse_status = 'accepted'`).get(wid, uid) as any
    const sampleCount = db.prepare(`SELECT COUNT(*) AS cnt FROM mh_samples WHERE workspace_id = ? AND user_id = ?`).get(wid, uid) as any
    const workoutCount = db.prepare(`SELECT COUNT(*) AS cnt FROM mh_workouts WHERE workspace_id = ? AND user_id = ?`).get(wid, uid) as any
    res.json({ lastIngest: lastIngest?.last_ingest ?? null, sampleCount: sampleCount?.cnt ?? 0, workoutCount: workoutCount?.cnt ?? 0 })
  })

  router.get("/v1/my-health/metrics", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid  = resolveWorkspaceId(auth)
    const uid  = resolveUserId(auth)
    const key  = String(req.query.metric ?? "")
    const days = Math.min(Number(req.query.days ?? 30), 365)

    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    const rows = key
      ? db.prepare(`SELECT day_utc, metric_key, unit, sum_value, avg_value, min_value, max_value, sample_count FROM mh_daily_aggregates WHERE workspace_id = ? AND user_id = ? AND metric_key = ? AND day_utc >= ? ORDER BY day_utc`).all(wid, uid, key, since)
      : db.prepare(`SELECT metric_key, MAX(day_utc) AS last_day, SUM(sample_count) AS total_samples, AVG(avg_value) AS overall_avg, unit FROM mh_daily_aggregates WHERE workspace_id = ? AND user_id = ? AND day_utc >= ? GROUP BY metric_key, unit ORDER BY total_samples DESC`).all(wid, uid, since)

    res.json({ metrics: rows, days, since })
  })

  router.get("/v1/my-health/workouts", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid  = resolveWorkspaceId(auth)
    const uid  = resolveUserId(auth)
    const days = Math.min(Number(req.query.days ?? 30), 365)
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const rows = db.prepare(`SELECT id, workout_type, start_time_utc, end_time_utc, duration_sec, energy_kcal, distance_m FROM mh_workouts WHERE workspace_id = ? AND user_id = ? AND start_time_utc >= ? ORDER BY start_time_utc DESC LIMIT 100`).all(wid, uid, since)
    res.json({ workouts: rows })
  })

  // ── Consent ───────────────────────────────────────────────────────────────

  router.get("/v1/my-health/consent", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)
    const row = db.prepare(`SELECT id, purpose, categories_json, accepted_at, revoked_at FROM mh_consent_receipts WHERE workspace_id = ? AND user_id = ? ORDER BY accepted_at DESC LIMIT 1`).get(wid, uid) as any
    if (!row || row.revoked_at) { res.json({ consent: null }); return }
    res.json({ consent: { ...row, categories: JSON.parse(row.categories_json) } })
  })

  router.post("/v1/my-health/consent", express.json(), (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)

    const parsed = ConsentSchema.safeParse(req.body ?? {})
    if (!parsed.success) { res.status(400).json({ error: "invalid_body" }); return }

    const id = uuid()
    db.prepare(`INSERT INTO mh_consent_receipts (id, workspace_id, user_id, purpose, categories_json, accepted_at) VALUES (?, ?, ?, ?, ?, ?)`).run(id, wid, uid, parsed.data.purpose ?? "personal_wellness", JSON.stringify(parsed.data.categories), now())
    res.status(201).json({ consentId: id, acceptedAt: now(), categories: parsed.data.categories })
  })

  // ── Export ────────────────────────────────────────────────────────────────

  router.get("/v1/my-health/export", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)

    const samples   = db.prepare(`SELECT * FROM mh_samples WHERE workspace_id = ? AND user_id = ? ORDER BY start_time_utc`).all(wid, uid)
    const workouts  = db.prepare(`SELECT * FROM mh_workouts WHERE workspace_id = ? AND user_id = ? ORDER BY start_time_utc`).all(wid, uid)
    const aggregates = db.prepare(`SELECT * FROM mh_daily_aggregates WHERE workspace_id = ? AND user_id = ? ORDER BY day_utc`).all(wid, uid)
    const sources   = db.prepare(`SELECT id, source_type, display_name, created_at, last_ingest FROM mh_sources WHERE workspace_id = ? AND user_id = ?`).all(wid, uid)
    const receipts  = db.prepare(`SELECT id, source_id, received_at, parse_status, record_count FROM mh_ingest_receipts WHERE workspace_id = ? AND user_id = ? ORDER BY received_at`).all(wid, uid)
    const consent   = db.prepare(`SELECT id, purpose, categories_json, accepted_at FROM mh_consent_receipts WHERE workspace_id = ? AND user_id = ? ORDER BY accepted_at`).all(wid, uid)

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Content-Disposition", `attachment; filename="my-health-export-${new Date().toISOString().slice(0,10)}.json"`)
    res.json({ exportedAt: now(), samples, workouts, aggregates, sources, receipts, consent })
  })

  // ── Delete all data ───────────────────────────────────────────────────────

  router.delete("/v1/my-health/data", (req, res) => {
    const auth = getAuthContext(req)
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return }
    const wid = resolveWorkspaceId(auth)
    const uid = resolveUserId(auth)

    const deleteTx = db.transaction(() => {
      const counts = {
        samples:    (db.prepare(`DELETE FROM mh_samples WHERE workspace_id = ? AND user_id = ?`).run(wid, uid)).changes,
        workouts:   (db.prepare(`DELETE FROM mh_workouts WHERE workspace_id = ? AND user_id = ?`).run(wid, uid)).changes,
        aggregates: (db.prepare(`DELETE FROM mh_daily_aggregates WHERE workspace_id = ? AND user_id = ?`).run(wid, uid)).changes,
        receipts:   (db.prepare(`DELETE FROM mh_ingest_receipts WHERE workspace_id = ? AND user_id = ?`).run(wid, uid)).changes,
        sources:    (db.prepare(`DELETE FROM mh_sources WHERE workspace_id = ? AND user_id = ?`).run(wid, uid)).changes,
        tokens:     (db.prepare(`UPDATE mh_ingest_tokens SET revoked_at = ? WHERE workspace_id = ? AND user_id = ? AND revoked_at IS NULL`).run(now(), wid, uid)).changes,
        consent:    (db.prepare(`UPDATE mh_consent_receipts SET revoked_at = ? WHERE workspace_id = ? AND user_id = ? AND revoked_at IS NULL`).run(now(), wid, uid)).changes,
      }
      return counts
    })

    const counts = deleteTx()
    res.json({ ok: true, deletedAt: now(), counts })
  })

  return router
}
