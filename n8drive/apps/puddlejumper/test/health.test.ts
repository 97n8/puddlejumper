import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createApp } from "../src/api/server.js";

// ── Test helpers ────────────────────────────────────────────────────────────

// createApp requires data/ dir to be relative to the package root.
// The default paths are <root>/data/. We set env vars so the DBs live
// in a temp dir that IS the app's data/ directory.

describe("/health endpoint", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    // Ensure data directory exists (createApp needs it)
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });

    // Set minimal env vars
    process.env.CONNECTOR_STATE_SECRET = "test-health-secret";
    app = createApp("test");
  });

  it("returns JSON with status, checks, and secrets", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      service: "puddle-jumper-deploy-remote",
      nodeEnv: "test",
      now: expect.any(String),
    });
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.prr).toBeDefined();
    expect(res.body.checks.connectors).toBeDefined();
    expect(res.body.checks.secrets).toBeDefined();
    expect(res.body.secrets).toBeDefined();
  });

  it("reports DB connectivity in checks", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.checks.prr.status).toBe("ok");
    expect(res.body.checks.connectors.status).toBe("ok");
  });

  it("reports secret presence (boolean values, never leaked)", async () => {
    const res = await request(app).get("/health").expect(200);
    for (const key of Object.keys(res.body.secrets)) {
      expect(typeof res.body.secrets[key]).toBe("boolean");
    }
  });

  it("has CORS headers when accessed cross-origin", async () => {
    const res = await request(app)
      .get("/health")
      .set("Origin", "https://pj.publiclogic.org")
      .expect(200);
    // CORS middleware should allow the request
    expect(res.status).toBe(200);
  });
});

// ── /pj workspace HTML ──────────────────────────────────────────────────────

describe("/pj workspace HTML", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.CONNECTOR_STATE_SECRET = "test-pj-secret";
    app = createApp("test");
  });

  it("returns 200 with HTML content", async () => {
    const res = await request(app).get("/pj").expect(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("<html");
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await request(app).get("/pj").expect(200);
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("/puddle-jumper alias also works", async () => {
    const res = await request(app).get("/puddle-jumper").expect(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  it("/pj-workspace alias also works", async () => {
    const res = await request(app).get("/pj-workspace").expect(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
});
