import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Isolate stores to a temp dir
const tmpDir = path.join(os.tmpdir(), `auth-refresh-test-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-auth";
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "test-issuer";
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "test-audience";
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_REDIRECT_URI = "http://localhost:3002/api/auth/github/callback";
  process.env.FRONTEND_URL = "http://localhost:3000";
});

const { resetDb } = await import("../src/api/refreshTokenStore.js");
const { resetAuditDb, queryAuditEvents } = await import("../src/api/auditStore.js");
const { cookieParserMiddleware, createOptionalJwtAuthenticationMiddleware, createJwtAuthenticationMiddleware, signJwt } = await import("@publiclogic/core");

// Build a lightweight test app wiring auth routes like server.ts does
function createTestApp() {
  const { createAuthRoutes } = require("../src/api/routes/auth.js") as typeof import("../src/api/routes/auth.js");
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // Optional auth for /api/auth/* paths (logout, revoke)
  app.use("/api/auth", createOptionalJwtAuthenticationMiddleware());
  // Hard auth for /api/admin/* paths (audit)
  app.use("/api/admin", createJwtAuthenticationMiddleware());

  const router = createAuthRoutes({
    builtInLoginEnabled: false,
    loginUsers: [],
    loginRateLimit: (_req: any, _res: any, next: any) => next(),
    nodeEnv: "test",
    trustedParentOrigins: ["http://localhost:3000"],
  });
  app.use("/api", router);
  return app;
}

// We also need the GitHub OAuth routes for login integration
async function createTestAppWithOAuth() {
  const { createAuthRoutes } = await import("../src/api/routes/auth.js");
  const { createGitHubOAuthRoutes } = await import("../src/api/routes/githubOAuth.js");
  const { OAuthStateStore } = await import("../src/api/oauthStateStore.js");

  const oauthStateDbPath = path.join(tmpDir, "oauth_state.db");
  const oauthStateStore = new OAuthStateStore(oauthStateDbPath);

  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // Optional auth for auth/* paths
  app.use("/api/auth", createOptionalJwtAuthenticationMiddleware());
  // Hard auth for admin/* paths
  app.use("/api/admin", createJwtAuthenticationMiddleware());

  app.use("/api", createAuthRoutes({
    builtInLoginEnabled: false,
    loginUsers: [],
    loginRateLimit: (_req: any, _res: any, next: any) => next(),
    nodeEnv: "test",
    trustedParentOrigins: ["http://localhost:3000"],
  }));
  app.use("/api", createGitHubOAuthRoutes({ nodeEnv: "test", oauthStateStore }));

  return { app, oauthStateStore };
}

// Helper: perform OAuth login and extract cookies
async function oauthLoginAndGetCookies(app: express.Express, oauthStateStore: any) {
  // Mock GitHub APIs
  global.fetch = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes("login/oauth/access_token")) {
      return { ok: true, json: async () => ({ access_token: "gho_mock" }) };
    }
    return {
      ok: true,
      json: async () => ({ id: 42, login: "testuser", name: "Test", email: "test@example.com" }),
    };
  });

  // Get state
  const loginRes = await request(app).get("/api/auth/github/login");
  const cookies = loginRes.headers["set-cookie"] as unknown as string[];
  const stateCookie = cookies.find((c: string) => c.startsWith("oauth_state="));
  const stateValue = stateCookie!.split("=")[1].split(";")[0];

  // Complete callback
  const callbackRes = await request(app)
    .get(`/api/auth/github/callback?code=test-code&state=${stateValue}`)
    .set("Cookie", `oauth_state=${stateValue}`);

  expect(callbackRes.status).toBe(302);

  const responseCookies = callbackRes.headers["set-cookie"] as unknown as string[];
  const refreshCookie = responseCookies.find((c: string) => c.startsWith("pj_refresh="))!.split(";")[0];
  const jwtCookie = responseCookies.find((c: string) => c.startsWith("jwt="))!.split(";")[0];

  return { refreshCookie, jwtCookie };
}

beforeEach(() => {
  resetDb();
  resetAuditDb();
});
afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  resetDb();
  resetAuditDb();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────
describe("POST /api/refresh", () => {
  it("returns 401 when no refresh cookie is present", async () => {
    const { app } = await createTestAppWithOAuth();
    const res = await request(app).post("/api/refresh");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no refresh token/i);
  });

  it("returns a new access jwt when given a valid refresh cookie", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    const refreshRes = await request(app)
      .post("/api/refresh")
      .set("Cookie", refreshCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("jwt");
    expect(typeof refreshRes.body.jwt).toBe("string");
    expect(refreshRes.body.jwt.split(".").length).toBe(3);
  });

  it("rotates refresh token and returns new cookie", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie: cookie1 } = await oauthLoginAndGetCookies(app, oauthStateStore);

    const refreshRes = await request(app)
      .post("/api/refresh")
      .set("Cookie", cookie1);
    expect(refreshRes.status).toBe(200);

    const newCookies = refreshRes.headers["set-cookie"] as unknown as string[];
    const cookie2 = newCookies.find((c: string) => c.startsWith("pj_refresh="))!.split(";")[0];
    expect(cookie2).toBeDefined();
    expect(cookie2).not.toBe(cookie1);
  });

  it("invalidates old refresh token after rotation", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie: oldCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    // First refresh succeeds
    await request(app).post("/api/refresh").set("Cookie", oldCookie);

    // Second use of old cookie — replay detected
    const retryRes = await request(app).post("/api/refresh").set("Cookie", oldCookie);
    expect(retryRes.status).toBe(401);
    expect(retryRes.body.error).toBe("token_reuse_detected");
  });

  it("replay detection revokes entire family chain", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie: cookie1 } = await oauthLoginAndGetCookies(app, oauthStateStore);

    // Rotate: cookie1 → cookie2
    const r1 = await request(app).post("/api/refresh").set("Cookie", cookie1);
    expect(r1.status).toBe(200);
    const cookie2 = (r1.headers["set-cookie"] as unknown as string[])
      .find((c: string) => c.startsWith("pj_refresh="))!.split(";")[0];

    // Replay cookie1 — triggers family revocation
    const replay = await request(app).post("/api/refresh").set("Cookie", cookie1);
    expect(replay.status).toBe(401);

    // cookie2 should also be revoked (same family)
    const r2 = await request(app).post("/api/refresh").set("Cookie", cookie2);
    expect(r2.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/logout", () => {
  it("revokes token and clears cookie", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Cookie should be cleared
    const setCookies = res.headers["set-cookie"] as unknown as string[];
    const cleared = setCookies?.find((c: string) => c.startsWith("pj_refresh="));
    expect(cleared).toContain("pj_refresh=");

    // Refresh with same cookie should fail
    const refreshRes = await request(app)
      .post("/api/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it("returns 200 even when no cookie is present", async () => {
    const { app } = await createTestAppWithOAuth();
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("POST /api/auth/revoke", () => {
  it("returns 401 without a Bearer token", async () => {
    const { app } = await createTestAppWithOAuth();
    const res = await request(app).post("/api/auth/revoke");
    expect(res.status).toBe(401);
  });

  it("revokes all tokens for the calling user", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    const accessToken = await signJwt(
      { sub: "42", name: "Test", role: "user" } as any,
      { expiresIn: "1h" } as any,
    );

    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("revoked");
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);

    // Refresh with same cookie should fail
    const refreshRes = await request(app)
      .post("/api/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(401);
  });

  it("non-admin cannot revoke another user", async () => {
    const { app } = await createTestAppWithOAuth();
    const accessToken = await signJwt(
      { sub: "42", name: "Test", role: "user" } as any,
      { expiresIn: "1h" } as any,
    );

    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ user_id: "other-user" });
    expect(res.status).toBe(403);
  });

  it("admin can revoke another user", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();

    // Login as a user to create tokens
    await oauthLoginAndGetCookies(app, oauthStateStore);

    const adminToken = await signJwt(
      { sub: "1", name: "Admin", role: "admin" } as any,
      { expiresIn: "1h" } as any,
    );

    const res = await request(app)
      .post("/api/auth/revoke")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ user_id: "42" });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Audit event persistence", () => {
  it("OAuth login emits auth.login event", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    await oauthLoginAndGetCookies(app, oauthStateStore);

    const events = queryAuditEvents({ event_type: "auth.login" });
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe("auth.login");
    expect(events[0].actor_id).toBe("42");
  });

  it("refresh emits auth.refresh event", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    const refreshRes = await request(app)
      .post("/api/refresh")
      .set("Cookie", refreshCookie);
    expect(refreshRes.status).toBe(200);

    const events = queryAuditEvents({ event_type: "auth.refresh" });
    expect(events.length).toBe(1);
  });

  it("replay emits auth.token_reuse_detected event", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();
    const { refreshCookie } = await oauthLoginAndGetCookies(app, oauthStateStore);

    // First refresh rotates
    await request(app).post("/api/refresh").set("Cookie", refreshCookie);
    // Replay old token
    const replay = await request(app).post("/api/refresh").set("Cookie", refreshCookie);
    expect(replay.status).toBe(401);

    const events = queryAuditEvents({ event_type: "auth.token_reuse_detected" });
    expect(events.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("GET /api/admin/audit", () => {
  it("returns 401 without auth", async () => {
    const { app } = await createTestAppWithOAuth();
    const res = await request(app).get("/api/admin/audit");
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const { app } = await createTestAppWithOAuth();
    const userToken = await signJwt(
      { sub: "42", name: "Test", role: "user" } as any,
      { expiresIn: "1h" } as any,
    );
    const res = await request(app)
      .get("/api/admin/audit")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it("returns audit events for admin", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();

    // Generate some events
    await oauthLoginAndGetCookies(app, oauthStateStore);

    const adminToken = await signJwt(
      { sub: "1", name: "Admin", role: "admin" } as any,
      { expiresIn: "1h" } as any,
    );
    const res = await request(app)
      .get("/api/admin/audit")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events).toBeInstanceOf(Array);
    expect(res.body.events.length).toBeGreaterThanOrEqual(1);
    expect(res.body.events[0]).toHaveProperty("event_type");
    expect(res.body.events[0]).toHaveProperty("timestamp");
  });

  it("filters by event_type", async () => {
    const { app, oauthStateStore } = await createTestAppWithOAuth();

    // Login to create an event
    await oauthLoginAndGetCookies(app, oauthStateStore);

    const adminToken = await signJwt(
      { sub: "1", name: "Admin", role: "admin" } as any,
      { expiresIn: "1h" } as any,
    );

    // Query for non-existent type
    const res = await request(app)
      .get("/api/admin/audit?event_type=auth.nonexistent")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBe(0);

    // Query for existing type
    const res2 = await request(app)
      .get("/api/admin/audit?event_type=auth.login")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res2.status).toBe(200);
    expect(res2.body.events.length).toBe(1);
  });
});
