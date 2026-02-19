import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { cookieParserMiddleware } from "@publiclogic/core";
import authCallback from "../src/api/authCallback.js";

// ── Env setup ───────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-callback";
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "test-issuer";
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "test-audience";
});

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv.FRONTEND_URL = process.env.FRONTEND_URL;
  delete process.env.FRONTEND_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, val] of Object.entries(savedEnv)) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
});

// ── Helper ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  app.get("/auth/callback", authCallback);
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("authCallback handler (legacy redirect)", () => {
  it("redirects to /login on the default frontend URL", async () => {
    const app = buildApp();
    const res = await request(app).get("/auth/callback");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://pj.publiclogic.org/login");
  });

  it("redirects to /login using FRONTEND_URL when set", async () => {
    process.env.FRONTEND_URL = "https://custom.example.com";
    const app = buildApp();
    const res = await request(app).get("/auth/callback");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://custom.example.com/login");
  });

  it("redirects even when providerToken is present (no longer processes it)", async () => {
    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=some-token");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://pj.publiclogic.org/login");
  });
});
