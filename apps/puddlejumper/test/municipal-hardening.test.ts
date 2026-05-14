import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../src/api/server.js";

describe("/ready endpoint", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.CONNECTOR_STATE_SECRET = "test-ready-secret";
    app = createApp("test");
  });

  it("returns 200 with status ready when DBs are accessible", async () => {
    const res = await request(app).get("/ready").expect(200);
    expect(res.body).toEqual({ status: "ready" });
  });

  it("is a lightweight check (no volume probe)", async () => {
    const res = await request(app).get("/ready").expect(200);
    // Should not have the detailed checks that /health has
    expect(res.body.checks).toBeUndefined();
    expect(res.body.secrets).toBeUndefined();
  });
});

describe("security headers", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    const dataDir = path.resolve(__dirname, "../data");
    fs.mkdirSync(dataDir, { recursive: true });
    process.env.CONNECTOR_STATE_SECRET = "test-headers-secret";
    app = createApp("test");
  });

  it("sets X-Content-Type-Options header on protected routes", async () => {
    // Security headers middleware is applied after /health,
    // so we test on a route that goes through the middleware
    const res = await request(app).get("/pj");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets Content-Security-Policy header on protected routes", async () => {
    const res = await request(app).get("/pj");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("default-src");
  });
});

