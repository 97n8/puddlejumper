import crypto from "node:crypto";
import express from "express";
import type Database from "better-sqlite3";
import { getAuthContext } from "@publiclogic/core";
import { z } from "zod";
import type { KillSwitchStore } from "../../ops/killSwitch.js";
import { decideDriveIntake } from "../../policy/driveIntakePolicy.js";

const SubjectSchema = z.object({
  provider: z.string(),
  file_id: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  owner: z.string(),
  owner_is_self: z.boolean(),
  is_shortcut: z.boolean(),
  parent_id: z.string(),
  created_time: z.string(),
  modified_time: z.string(),
  size_bytes: z.number().nullable(),
});

const ClassificationSchema = z.object({
  category: z.string(),
  project: z.string().nullable(),
  work_state: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  matched_rules: z.array(z.string()),
  classifier: z.string(),
  reason: z.string(),
});

const ProposedPlanSchema = z.object({
  dispatcher: z.string(),
  action: z.enum(["move", "shortcut", "noop", "review"]),
  plan: z.record(z.string(), z.unknown()),
});

const PolicyContextSchema = z.object({
  dry_run: z.boolean(),
  legal_ip_sensitive: z.boolean(),
  externally_owned: z.boolean(),
});

export const InputPayloadSchema = z.object({
  payload_version: z.literal("1.0"),
  source: z.string().min(1),
  intent: z.literal("organize_drive_file"),
  emitted_at: z.string(),
  run_id: z.string(),
  subject: SubjectSchema,
  classification: ClassificationSchema,
  proposed_plan: ProposedPlanSchema,
  policy_context: PolicyContextSchema,
});

type InputPayload = z.infer<typeof InputPayloadSchema>;

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private lastSeen: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
    this.lastSeen = this.lastRefill;
  }

  take(): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
    this.lastSeen = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  isStale(now: number, idleTtlMs: number): boolean {
    return now - this.lastSeen > idleTtlMs;
  }
}

class PerSourceRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly idleTtlMs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    idleTtlMs: number = 15 * 60_000,
  ) {
    this.idleTtlMs = idleTtlMs;
  }

  allow(source: string): boolean {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.isStale(now, this.idleTtlMs)) {
        this.buckets.delete(key);
      }
    }

    let bucket = this.buckets.get(source);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerSec);
      this.buckets.set(source, bucket);
    }
    return bucket.take();
  }
}

class PayloadSubmissionStore {
  constructor(private readonly db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payload_submissions (
        idempotency_key TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        subject_file_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        chain_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        chain_template TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payload_submissions_source
        ON payload_submissions (source, subject_file_id);
    `);
  }

  get(idempotencyKey: string) {
    return this.db
      .prepare(`
        SELECT idempotency_key, chain_id, decision, chain_template, created_at
        FROM payload_submissions
        WHERE idempotency_key = ?
      `)
      .get(idempotencyKey) as
      | {
          idempotency_key: string;
          chain_id: string;
          decision: string;
          chain_template: string | null;
          created_at: string;
        }
      | undefined;
  }

  insert(input: {
    idempotencyKey: string;
    source: string;
    subjectFileId: string;
    payloadHash: string;
    chainId: string;
    decision: string;
    chainTemplate: string | null;
  }): void {
    this.db
      .prepare(`
        INSERT INTO payload_submissions (
          idempotency_key, source, subject_file_id, payload_hash, chain_id, decision, chain_template, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.idempotencyKey,
        input.source,
        input.subjectFileId,
        input.payloadHash,
        input.chainId,
        input.decision,
        input.chainTemplate,
        new Date().toISOString(),
      );
  }
}

type PayloadAuthRequest = express.Request & {
  payloadSourceId?: string;
};

type CreatePayloadsRouterOptions = {
  db: Database.Database;
  killSwitch: KillSwitchStore;
  sharedToken: string;
  allowedSources?: string[];
  rateLimitCapacity?: number;
  rateLimitRefillPerSec?: number;
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveActor(req: PayloadAuthRequest, sharedToken: string): string | null {
  const auth = getAuthContext(req);
  if (auth?.userId || auth?.sub) {
    return auth.userId ?? auth.sub ?? null;
  }

  const authHeader = req.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || !sharedToken) {
    return null;
  }
  const tokenBuffer = Buffer.from(token, "utf8");
  const sharedTokenBuffer = Buffer.from(sharedToken, "utf8");
  if (tokenBuffer.length !== sharedTokenBuffer.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(tokenBuffer, sharedTokenBuffer)) {
    return null;
  }

  const sourceHeader = req.get("x-pj-source")?.trim();
  return sourceHeader || "drive-intake-router";
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deriveIdempotencyKey(payload: InputPayload, payloadHash: string): string {
  return crypto
    .createHash("sha256")
    .update(`${payload.source}:${payload.run_id}:${payload.subject.file_id}:${payloadHash}`)
    .digest("hex");
}

function hasKillSwitchAdminAccess(req: express.Request): boolean {
  const auth = getAuthContext(req);
  if (!auth || auth.role !== "admin") {
    return false;
  }
  const permissions = Array.isArray(auth.permissions)
    ? auth.permissions.map((entry) => String(entry).toLowerCase())
    : [];
  return permissions.includes("seal");
}

export function createPayloadsRouter(opts: CreatePayloadsRouterOptions): express.Router {
  const router = express.Router();
  const limiter = new PerSourceRateLimiter(
    opts.rateLimitCapacity ?? 60,
    opts.rateLimitRefillPerSec ?? 10,
  );
  const store = new PayloadSubmissionStore(opts.db);
  const allowedSources = new Set(
    (opts.allowedSources && opts.allowedSources.length > 0
      ? opts.allowedSources
      : ["drive-intake-router"]).map((entry) => entry.trim()).filter(Boolean),
  );

  router.post("/payloads", (req: PayloadAuthRequest, res) => {
    const actor = resolveActor(req, opts.sharedToken);
    if (!actor) {
      res.status(401).json({ error: "Source identity required" });
      return;
    }

    const killState = opts.killSwitch.read();
    if (killState.enabled) {
      res.status(503).json({
        error: "service_paused",
        message: "PJ payload intake is paused.",
      });
      return;
    }

    const parsed = InputPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_payload",
        message: "Payload failed schema validation.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      });
      return;
    }

    const payload = parsed.data;
    if (!allowedSources.has(payload.source)) {
      res.status(403).json({ error: `Source ${payload.source} is not allowed` });
      return;
    }
    if (!limiter.allow(actor)) {
      res.status(429).json({
        error: "rate_limited",
        message: `Source ${actor} exceeded payload submission rate.`,
        retry_after_seconds: 1,
      });
      return;
    }

    const operation =
      payload.proposed_plan.plan && typeof payload.proposed_plan.plan.operation === "string"
        ? payload.proposed_plan.plan.operation
        : "unknown";

    if (payload.classification.confidence < 0.7 && operation !== "noop") {
      res.status(400).json({
        error: "confidence_floor",
        message: `Payload confidence ${payload.classification.confidence} below 0.70 floor for non-noop plans.`,
      });
      return;
    }

    const decision = decideDriveIntake({
      classification: payload.classification,
      policy_context: payload.policy_context,
      proposed_plan: {
        action: payload.proposed_plan.action,
        plan: { operation },
      },
    });

    if (decision.decision === "reject") {
      res.status(422).json({
        error: "policy_rejected",
        message: decision.rationale,
      });
      return;
    }

    const payloadHash = crypto.createHash("sha256").update(stableStringify(payload)).digest("hex");
    const idempotencyKey = deriveIdempotencyKey(payload, payloadHash);
    const existing = store.get(idempotencyKey);
    if (existing) {
      res.status(200).json({
        accepted: true,
        chain_id: existing.chain_id,
        chain_template: existing.chain_template,
        decision: existing.decision,
        idempotent: true,
        stub: true,
        status: "queued_pending_implementation",
      });
      return;
    }

    const chainId = `chain_${crypto.randomUUID()}`;
    store.insert({
      idempotencyKey,
      source: payload.source,
      subjectFileId: payload.subject.file_id,
      payloadHash,
      chainId,
      decision: decision.decision,
      chainTemplate: decision.chain_template,
    });

    res.status(202).json({
      accepted: true,
      chain_id: chainId,
      chain_template: decision.chain_template,
      decision: decision.decision,
      idempotent: false,
      stub: true,
      status: "queued_pending_implementation",
    });
  });

  router.get("/admin/payloads/kill-switch", (req, res) => {
    if (!hasKillSwitchAdminAccess(req)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    res.json(opts.killSwitch.read());
  });

  router.post("/admin/payloads/kill-switch", (req, res) => {
    const auth = getAuthContext(req);
    if (!auth || !hasKillSwitchAdminAccess(req)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    const schema = z.object({
      enabled: z.boolean(),
      reason: z.string().trim().max(500).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const state = opts.killSwitch.set({
      enabled: parsed.data.enabled,
      reason: parsed.data.reason ?? null,
      setBy: auth.userId ?? auth.sub ?? "admin",
    });
    res.status(200).json(state);
  });

  return router;
}

export function resolveAllowedPayloadSources(value: string | undefined): string[] {
  const sources = parseCsv(value);
  return sources.length > 0 ? sources : ["drive-intake-router"];
}
