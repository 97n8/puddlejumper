import { describe, it, expect, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { createRateLimit } from "../src/api/rateLimit.js";

const tmpDir = path.join(os.tmpdir(), `oauth-ratelimit-test-${Date.now()}`);

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("OAuth login rate limiting", () => {
  it("returns 429 after exceeding 10 requests per minute per IP", async () => {
    const dbPath = path.join(tmpDir, "rl1.db");
    const rl = createRateLimit({
      windowMs: 60_000,
      max: 10,
      keyGenerator: (req) => `oauth-login:ip:${req.ip}`,
      dbPath,
    });

    const app = express();
    app.use("/login", rl);
    app.get("/login", (_req, res) => res.status(302).json({ ok: true }));

    const results: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app).get("/login");
      results.push(res.status);
    }

    // First 10 should pass (302), 11th+ should be 429
    expect(results.slice(0, 10).every((s) => s === 302)).toBe(true);
    expect(results[10]).toBe(429);
    expect(results[11]).toBe(429);
  });

  it("rate limit applies across multiple paths sharing the same limiter", async () => {
    const dbPath = path.join(tmpDir, "rl2.db");
    const rl = createRateLimit({
      windowMs: 60_000,
      max: 10,
      keyGenerator: (req) => `oauth-login:ip:${req.ip}`,
      dbPath,
    });

    const app = express();
    app.use("/a", rl);
    app.use("/b", rl);
    app.use("/c", rl);
    app.get("/a", (_req, res) => res.status(302).json({ ok: true }));
    app.get("/b", (_req, res) => res.status(302).json({ ok: true }));
    app.get("/c", (_req, res) => res.status(302).json({ ok: true }));

    // Burn 4 on /a, 4 on /b = 8 total
    for (let i = 0; i < 4; i++) await request(app).get("/a");
    for (let i = 0; i < 4; i++) await request(app).get("/b");

    // 2 more on /c should pass (total 10), 3rd should be 429
    const c1 = await request(app).get("/c");
    const c2 = await request(app).get("/c");
    const c3 = await request(app).get("/c");

    expect(c1.status).toBe(302);
    expect(c2.status).toBe(302);
    expect(c3.status).toBe(429);
  });

  it("includes rate limit headers in responses", async () => {
    const dbPath = path.join(tmpDir, "rl3.db");
    const rl = createRateLimit({
      windowMs: 60_000,
      max: 10,
      keyGenerator: (req) => `oauth-login:ip:${req.ip}`,
      dbPath,
    });

    const app = express();
    app.use("/login", rl);
    app.get("/login", (_req, res) => res.status(302).json({ ok: true }));

    const res = await request(app).get("/login");
    expect(res.headers["x-ratelimit-limit"]).toBe("10");
    expect(res.headers["x-ratelimit-remaining"]).toBe("9");
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
  });
});
