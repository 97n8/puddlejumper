// ── Session-lifecycle route tests ─────────────────────────────────────────────
//
// Exercises createSessionRoutes() HTTP endpoints via supertest.
//
// Routes under test (all mounted under /api):
//   GET  /auth/status   — lightweight session probe (never 401)
//   GET  /session        — SSO cookie verification
//   POST /refresh        — token rotation with replay detection
//   POST /auth/logout    — revoke refresh token + clear cookies
//   POST /auth/revoke    — revoke all tokens for calling user (admin: any user)
//   GET  /admin/audit    — admin audit event query
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Isolate stores to a temp dir — MUST come before importing stores
const tmpDir = path.join(os.tmpdir(), `lc-session-routes-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = "test-session-routes-secret";
  process.env.AUTH_ISSUER = "test-issuer";
  process.env.AUTH_AUDIENCE = "test-audience";
});

const { resetDb } = await import("../src/lib/refresh-store.js");
const { resetAuditDb, queryAuditEvents } = await import("../src/lib/audit-store.js");
const {
  signJwt,
  createOptionalJwtAuthenticationMiddleware,
  createJwtAuthenticationMiddleware,
} = await import("@publiclogic/core");
const { createSessionRoutes } = await import("../src/routes/login.js");
const { createRefreshToken } = await import("../src/lib/refresh-store.js");

// ── Helpers ──────────────────────────────────────────────────────────────────

const USER = { sub: "user-1", email: "a@b.com", name: "Alice", provider: "github", role: "user" };
const ADMIN = { sub: "admin-1", email: "admin@b.com", name: "Root", provider: "github", role: "admin" };

async function accessJwt(claims: Record<string, any> = USER) {
  return signJwt(claims, { expiresIn: "1h" });
}

async function refreshJwt(claims: Record<string, any>) {
  return signJwt({ ...claims, token_type: "refresh" }, { expiresIn: "7d" });
}

function makeApp() {
  const app = express();
  app.use(require("cookie-parser")());
  app.use(express.json());
  // Optional auth for /api/auth/* (never 401 for status, but req.auth available)
  app.use("/api/auth", createOptionalJwtAuthenticationMiddleware());
  // Hard auth for /api/admin/*
  app.use("/api/admin", createJwtAuthenticationMiddleware());
  app.use("/api", createSessionRoutes({ nodeEnv: "test" }));
  return app;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb();
  resetAuditDb();
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/status
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/status", () => {
  it("returns authenticated:false when no cookie present", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/status");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ authenticated: false });
  });

  it("returns authenticated:true with user info when jwt cookie set", async () => {
    const app = makeApp();
    const jwt = await accessJwt();
    const res = await request(app).get("/api/auth/status").set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.sub).toBe("user-1");
    expect(res.body.user.email).toBe("a@b.com");
    expect(res.body.user.provider).toBe("github");
  });

  it("returns authenticated:false with invalid cookie", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/status").set("Cookie", "jwt=garbage");
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/session
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/session", () => {
  it("returns 401 when no session cookie", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/session");
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("returns user when pj_sso cookie contains valid JWT", async () => {
    const app = makeApp();
    const jwt = await accessJwt();
    const res = await request(app).get("/api/session").set("Cookie", `pj_sso=${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.sub).toBe("user-1");
  });

  it("returns user when jwt cookie is used as fallback", async () => {
    const app = makeApp();
    const jwt = await accessJwt();
    const res = await request(app).get("/api/session").set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.sub).toBe("user-1");
  });

  it("returns 401 for expired token", async () => {
    const app = makeApp();
    const jwt = await signJwt(USER, { expiresIn: "0s" });
    // Small delay to ensure expiry
    await new Promise((r) => setTimeout(r, 50));
    const res = await request(app).get("/api/session").set("Cookie", `pj_sso=${jwt}`);
    expect(res.status).toBe(401);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/refresh
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/refresh", () => {
  it("returns 401 when no pj_refresh cookie is present", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("no refresh token");
  });

  it("rotates token and returns new jwt + user", async () => {
    const app = makeApp();
    // Create a persisted refresh token
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });

    const res = await request(app).post("/api/refresh").set("Cookie", `pj_refresh=${rtJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.jwt).toBeTruthy();
    expect(res.body.user.sub).toBe(USER.sub);

    // Should set pj_refresh and jwt cookies
    const setCookieHeader = res.headers["set-cookie"];
    const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader ? [setCookieHeader] : [];
    expect(setCookies.some((c: string) => c.startsWith("pj_refresh="))).toBe(true);
    expect(setCookies.some((c: string) => c.startsWith("jwt="))).toBe(true);
  });

  it("detects token reuse (replay attack) and returns 401", async () => {
    const app = makeApp();
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });

    // First rotation — should succeed
    const res1 = await request(app).post("/api/refresh").set("Cookie", `pj_refresh=${rtJwt}`);
    expect(res1.status).toBe(200);

    // Replay the same token — family should be revoked
    const res2 = await request(app).post("/api/refresh").set("Cookie", `pj_refresh=${rtJwt}`);
    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe("token_reuse_detected");
  });

  it("returns 401 for non-refresh JWT (missing token_type)", async () => {
    const app = makeApp();
    const jwt = await accessJwt(); // no token_type: "refresh"
    const res = await request(app).post("/api/refresh").set("Cookie", `pj_refresh=${jwt}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid refresh token");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/logout", () => {
  it("clears cookies and returns ok:true even when no refresh token", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("revokes refresh token and clears cookies", async () => {
    const app = makeApp();
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });

    const res = await request(app).post("/api/auth/logout").set("Cookie", `pj_refresh=${rtJwt}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // The revoked token should no longer work for refresh
    const res2 = await request(app).post("/api/refresh").set("Cookie", `pj_refresh=${rtJwt}`);
    expect(res2.status).toBe(401);
  });

  it("logs logout audit event", async () => {
    const app = makeApp();
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });
    await request(app).post("/api/auth/logout").set("Cookie", `pj_refresh=${rtJwt}`);

    const events = queryAuditEvents({ event_type: "auth.logout" });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/auth/revoke
// ═════════════════════════════════════════════════════════════════════════════
describe("POST /api/auth/revoke", () => {
  it("returns 401 if not authenticated", async () => {
    const app = makeApp();
    const res = await request(app).post("/api/auth/revoke");
    // optional auth won't 401 but auth.sub will be undefined → route returns 401
    expect(res.status).toBe(401);
  });

  it("revokes calling user's own tokens", async () => {
    const app = makeApp();
    // Use a unique user so other tests' tokens don't interfere
    const uniqueUser = { ...USER, sub: "revoke-self-user" };
    createRefreshToken(uniqueUser.sub, null, 7 * 24 * 60 * 60);
    createRefreshToken(uniqueUser.sub, null, 7 * 24 * 60 * 60);

    const jwt = await accessJwt(uniqueUser);
    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Cookie", `jwt=${jwt}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
  });

  it("admin can revoke another user's tokens", async () => {
    const app = makeApp();
    createRefreshToken("target-user", null, 7 * 24 * 60 * 60);

    const jwt = await accessJwt(ADMIN);
    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Cookie", `jwt=${jwt}`)
      .send({ user_id: "target-user" });

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(1);
  });

  it("non-admin cannot revoke another user's tokens", async () => {
    const app = makeApp();
    createRefreshToken("target-user", null, 7 * 24 * 60 * 60);

    const jwt = await accessJwt(USER);
    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Cookie", `jwt=${jwt}`)
      .send({ user_id: "target-user" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/admin/audit
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/admin/audit", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/admin/audit");
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    const app = makeApp();
    const jwt = await accessJwt(USER);
    const res = await request(app).get("/api/admin/audit").set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(403);
  });

  it("returns events for admin user", async () => {
    const app = makeApp();

    // Generate audit events via a logout
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });
    await request(app).post("/api/auth/logout").set("Cookie", `pj_refresh=${rtJwt}`);

    const jwt = await accessJwt(ADMIN);
    const res = await request(app).get("/api/admin/audit").set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
  });

  it("supports event_type filter", async () => {
    const app = makeApp();

    // Generate a logout event
    const row = createRefreshToken(USER.sub, null, 7 * 24 * 60 * 60);
    const rtJwt = await refreshJwt({ ...USER, jti: row.id, family: row.family });
    await request(app).post("/api/auth/logout").set("Cookie", `pj_refresh=${rtJwt}`);

    const jwt = await accessJwt(ADMIN);
    const res = await request(app)
      .get("/api/admin/audit?event_type=auth.logout")
      .set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.events.every((e: any) => e.event_type === "auth.logout")).toBe(true);
  });

  it("supports limit parameter", async () => {
    const app = makeApp();

    // Generate several events
    for (let i = 0; i < 5; i++) {
      const row = createRefreshToken(`user-${i}`, null, 7 * 24 * 60 * 60);
      const rtJwt = await refreshJwt({ sub: `user-${i}`, email: `u${i}@b.com`, name: "U", provider: "gh", jti: row.id, family: row.family });
      await request(app).post("/api/auth/logout").set("Cookie", `pj_refresh=${rtJwt}`);
    }

    const jwt = await accessJwt(ADMIN);
    const res = await request(app)
      .get("/api/admin/audit?limit=2")
      .set("Cookie", `jwt=${jwt}`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeLessThanOrEqual(2);
  });
});
