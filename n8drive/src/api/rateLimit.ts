import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Request, RequestHandler } from "express";

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  dbPath?: string;
};

type BucketRow = {
  count: number;
  reset_at: number;
  last_seen: number;
};

export function createRateLimit(options: RateLimitOptions): RequestHandler {
  const windowMs = Math.max(1, options.windowMs);
  const max = Math.max(1, options.max);
  const keyGenerator = options.keyGenerator ?? ((req: Request) => req.ip || "unknown");
  const dbPath = path.resolve(options.dbPath ?? process.env.RATE_LIMIT_DB_PATH ?? "./data/rate-limit.db");
  const ttlMs = 10 * 60 * 1000;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limit_last_seen ON rate_limit_buckets(last_seen);
  `);

  const readBucket = db.prepare("SELECT count, reset_at, last_seen FROM rate_limit_buckets WHERE key = ?");
  const insertBucket = db.prepare(
    "INSERT OR REPLACE INTO rate_limit_buckets (key, count, reset_at, last_seen) VALUES (?, ?, ?, ?)"
  );
  const updateBucket = db.prepare("UPDATE rate_limit_buckets SET count = ?, reset_at = ?, last_seen = ? WHERE key = ?");
  const pruneBuckets = db.prepare("DELETE FROM rate_limit_buckets WHERE last_seen < ?");
  const applyRateLimit = db.transaction((key: string, now: number) => {
    const row = readBucket.get(key) as BucketRow | undefined;
    if (!row || row.reset_at <= now) {
      const resetAt = now + windowMs;
      insertBucket.run(key, 1, resetAt, now);
      return { count: 1, resetAt };
    }

    const nextCount = row.count + 1;
    updateBucket.run(nextCount, row.reset_at, now, key);
    return { count: nextCount, resetAt: row.reset_at };
  });

  const interval = setInterval(() => {
    pruneBuckets.run(Date.now() - ttlMs);
  }, 60_000);
  interval.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    const activeBucket = applyRateLimit(key, now);
    const remaining = Math.max(0, max - activeBucket.count);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(activeBucket.resetAt / 1000)));

    if (activeBucket.count > max) {
      res.status(429).json({ error: "Too Many Requests", code: "RATE_LIMITED" });
      return;
    }

    next();
  };
}
