// ── OAuth route factory tests ─────────────────────────────────────────────────
//
// Exercises createOAuthRoutes() — login redirect, callback code-exchange, CSRF
// state validation, and error handling. Uses a synthetic provider so the tests
// are provider-agnostic and don't hit real APIs.
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Isolate stores to a temp dir — MUST come before importing stores
const tmpDir = path.join(os.tmpdir(), `lc-oauth-factory-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = "test-oauth-factory-secret";
  process.env.AUTH_ISSUER = "test-issuer";
  process.env.AUTH_AUDIENCE = "test-audience";
  process.env.FRONTEND_URL = "http://localhost:3000";
  process.env.TEST_PROVIDER_CLIENT_ID = "test-client-id";
  process.env.TEST_PROVIDER_CLIENT_SECRET = "test-client-secret";
  process.env.TEST_PROVIDER_REDIRECT_URI = "http://localhost:3002/api/auth/testprov/callback";
});

const { OAuthStateStore } = await import("../src/lib/state-store.js");
const { resetDb } = await import("../src/lib/refresh-store.js");
const { resetAuditDb } = await import("../src/lib/audit-store.js");
const { createOAuthRoutes } = await import("../src/lib/oauth.js");

import type { OAuthProvider, OAuthRouteOptions } from "../src/lib/oauth.js";

// ── Test provider (no real HTTP calls) ───────────────────────────────────────

function makeTestProvider(overrides?: Partial<OAuthProvider>): OAuthProvider {
  return {
    name: "testprov",
    authorizeUrl: "https://auth.example.com/authorize",
    tokenUrl: "https://auth.example.com/token",
    scopes: "openid email",
    tokenContentType: "json",
    stateCookieName: "oauth_state_test",
    clientIdEnvVar: "TEST_PROVIDER_CLIENT_ID",
    clientSecretEnvVar: "TEST_PROVIDER_CLIENT_SECRET",
    redirectUriEnvVar: "TEST_PROVIDER_REDIRECT_URI",
    defaultRedirectUri: "http://localhost:3002/api/auth/testprov/callback",
    fetchUserInfo: async (_token: string) => ({
      sub: "test-user-42",
      email: "test@example.com",
      name: "Test User",
    }),
    ...overrides,
  };
}

let stateStore: InstanceType<typeof OAuthStateStore>;

function makeApp(provider?: OAuthProvider) {
  const p = provider ?? makeTestProvider();
  stateStore = new OAuthStateStore(path.join(tmpDir, `oauth_state_${Date.now()}.db`));
  const opts: OAuthRouteOptions = { nodeEnv: "test", oauthStateStore: stateStore };
  const app = express();
  app.use(require("cookie-parser")());
  app.use(express.json());
  app.use("/api", createOAuthRoutes(p, opts));
  return app;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  resetDb();
  resetAuditDb();
});

afterAll(async () => {
  stateStore?.close?.();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/<provider>/login
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/:provider/login", () => {
  it("redirects to the provider authorize URL with correct params", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/testprov/login").redirects(0);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.location);
    expect(location.origin + location.pathname).toBe("https://auth.example.com/authorize");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3002/api/auth/testprov/callback",
    );
    expect(location.searchParams.get("response_type")).toBe("code");
    expect(location.searchParams.get("scope")).toBe("openid email");
    expect(location.searchParams.get("state")).toBeTruthy();
  });

  it("sets a CSRF state cookie", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/testprov/login").redirects(0);

    const cookies = res.headers["set-cookie"] as string[];
    expect(cookies.some((c: string) => c.startsWith("oauth_state_test="))).toBe(true);
  });

  it("appends extraAuthorizeParams when provided", async () => {
    const provider = makeTestProvider({
      extraAuthorizeParams: { prompt: "consent", access_type: "offline" },
    });
    const app = makeApp(provider);
    const res = await request(app).get("/api/auth/testprov/login").redirects(0);

    const location = new URL(res.headers.location);
    expect(location.searchParams.get("prompt")).toBe("consent");
    expect(location.searchParams.get("access_type")).toBe("offline");
  });

  it("returns 500 if client ID env var is not set", async () => {
    const provider = makeTestProvider({ clientIdEnvVar: "NONEXISTENT_CLIENT_ID_VAR" });
    const app = makeApp(provider);
    const res = await request(app).get("/api/auth/testprov/login");

    expect(res.status).toBe(500);
    expect(res.body.error).toContain("not configured");
  });

  it("supports function-style authorizeUrl", async () => {
    const provider = makeTestProvider({
      authorizeUrl: (env) => `https://login.example.com/${env.NODE_ENV ?? "dev"}/authorize`,
    });
    const app = makeApp(provider);
    const res = await request(app).get("/api/auth/testprov/login").redirects(0);

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toContain("login.example.com");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/auth/<provider>/callback
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/auth/:provider/callback", () => {
  it("returns 400 for provider-returned error", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/auth/testprov/callback?error=access_denied&error_description=User+denied");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("access_denied");
  });

  it("returns 400 when state is missing", async () => {
    const app = makeApp();
    const res = await request(app).get("/api/auth/testprov/callback?code=abc123");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("state");
  });

  it("returns 400 when state is invalid (not in store)", async () => {
    const app = makeApp();
    const res = await request(app)
      .get("/api/auth/testprov/callback?code=abc123&state=bogus");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("state");
  });

  it("returns 400 when code is missing but state is valid", async () => {
    const app = makeApp();
    const validState = stateStore.create("testprov");
    const res = await request(app)
      .get(`/api/auth/testprov/callback?state=${validState}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("code");
  });

  it("exchanges code for token and redirects to frontend on success", async () => {
    const app = makeApp();
    const validState = stateStore.create("testprov");

    // Mock fetch: first call = token exchange, second = userinfo (handled by fetchUserInfo)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "mock-access-tok" }),
    });

    try {
      const res = await request(app)
        .get(`/api/auth/testprov/callback?code=good-code&state=${validState}`)
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("http://localhost:3000");

      // Should set jwt and pj_refresh cookies
      const cookies = res.headers["set-cookie"] as string[];
      expect(cookies.some((c: string) => c.startsWith("jwt="))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith("pj_refresh="))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("state is single-use (consumed on first callback)", async () => {
    const app = makeApp();
    const validState = stateStore.create("testprov");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "mock-tok" }),
    });

    try {
      // First use — should succeed
      const res1 = await request(app)
        .get(`/api/auth/testprov/callback?code=code1&state=${validState}`)
        .redirects(0);
      expect(res1.status).toBe(302);

      // Second use same state — should fail
      const res2 = await request(app)
        .get(`/api/auth/testprov/callback?code=code2&state=${validState}`);
      expect(res2.status).toBe(400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("redirects to frontend with error hash when token exchange fails", async () => {
    const app = makeApp();
    const validState = stateStore.create("testprov");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ error: "invalid_grant" }),
    });

    try {
      const res = await request(app)
        .get(`/api/auth/testprov/callback?code=bad-code&state=${validState}`)
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("#error=authentication_failed");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("redirects to frontend with error hash when fetchUserInfo throws", async () => {
    const provider = makeTestProvider({
      fetchUserInfo: async () => {
        throw new Error("User API down");
      },
    });
    const app = makeApp(provider);
    const validState = stateStore.create("testprov");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "tok" }),
    });

    try {
      const res = await request(app)
        .get(`/api/auth/testprov/callback?code=code&state=${validState}`)
        .redirects(0);

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain("#error=authentication_failed");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
