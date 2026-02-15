import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Isolate stores to a temp dir
const tmpDir = path.join(os.tmpdir(), `oauth-redirect-test-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-oauth";
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "test-issuer";
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "test-audience";
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
  process.env.GITHUB_REDIRECT_URI = "http://localhost:3002/api/auth/github/callback";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3002/api/auth/google/callback";
  process.env.MICROSOFT_CLIENT_ID = "test-microsoft-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "test-microsoft-client-secret";
  process.env.MICROSOFT_REDIRECT_URI = "http://localhost:3002/api/auth/microsoft/callback";
  process.env.MICROSOFT_TENANT_ID = "common";
  process.env.FRONTEND_URL = "http://localhost:3000";
});

const { resetDb } = await import("../src/api/refreshTokenStore.js");
const { resetAuditDb } = await import("../src/api/auditStore.js");
const { cookieParserMiddleware, createOptionalJwtAuthenticationMiddleware } = await import("@publiclogic/core");

async function createTestApp() {
  const { createAuthRoutes } = await import("../src/api/routes/auth.js");
  const { createOAuthRoutes, githubProvider, googleProvider, microsoftProvider, OAuthStateStore, createSessionRoutes } = await import("@publiclogic/logic-commons");

  const oauthStateDbPath = path.join(tmpDir, "oauth_state.db");
  const oauthStateStore = new OAuthStateStore(oauthStateDbPath);

  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());
  app.use("/api/auth", createOptionalJwtAuthenticationMiddleware());

  app.use("/api", createAuthRoutes({
    builtInLoginEnabled: false,
    loginUsers: [],
    loginRateLimit: (_req: any, _res: any, next: any) => next(),
    nodeEnv: "test",
    trustedParentOrigins: ["http://localhost:3000"],
  }));
  // Session lifecycle routes from logic-commons
  app.use("/api", createSessionRoutes({ nodeEnv: "test" }));
  const oauthRouteOpts = { nodeEnv: "test", oauthStateStore };
  app.use("/api", createOAuthRoutes(githubProvider, oauthRouteOpts));
  app.use("/api", createOAuthRoutes(googleProvider, oauthRouteOpts));
  app.use("/api", createOAuthRoutes(microsoftProvider, oauthRouteOpts));

  return app;
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

// ── GitHub OAuth ────────────────────────────────────────────────────────────
describe("GitHub OAuth redirect flow", () => {
  it("GET /api/auth/github/login redirects to GitHub with correct params", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/auth/github/login");

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toContain("https://github.com/login/oauth/authorize");
    expect(location).toContain("client_id=test-client-id");
    expect(location).toContain("scope=user%3Aemail");
    expect(location).toContain("state=");

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain("HttpOnly");
  });

  it("returns 500 if GITHUB_CLIENT_ID is not set", async () => {
    const original = process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_ID;
    try {
      const app = await createTestApp();
      const res = await request(app).get("/api/auth/github/login");
      expect(res.status).toBe(500);
      expect(res.body.error).toContain("not configured");
    } finally {
      process.env.GITHUB_CLIENT_ID = original;
    }
  });

  it("rejects callback with mismatched state", async () => {
    const app = await createTestApp();
    const res = await request(app)
      .get("/api/auth/github/callback?code=test-code&state=wrong-state")
      .set("Cookie", "oauth_state=correct-state");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("state");
  });

  it("completes full OAuth flow with refresh token", async () => {
    const app = await createTestApp();

    // Step 1: Get redirect and state
    const loginRes = await request(app).get("/api/auth/github/login");
    expect(loginRes.status).toBe(302);
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("oauth_state="));
    const stateValue = stateCookie!.split("=")[1].split(";")[0];

    // Step 2: Mock GitHub APIs
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("login/oauth/access_token")) {
        return { ok: true, json: async () => ({ access_token: "gho_mock" }) };
      }
      if (String(url).includes("api.github.com/user")) {
        return { ok: true, json: async () => ({ id: 12345, login: "octocat", name: "Octocat", email: "octocat@github.com" }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    // Step 3: Hit callback
    const callbackRes = await request(app)
      .get(`/api/auth/github/callback?code=test-auth-code&state=${stateValue}`)
      .set("Cookie", `oauth_state=${stateValue}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("http://localhost:3000");

    // Should set both jwt and pj_refresh cookies
    const responseCookies = callbackRes.headers["set-cookie"] as unknown as string[];
    const jwtCookie = responseCookies.find((c: string) => c.startsWith("jwt="));
    expect(jwtCookie).toBeDefined();
    expect(jwtCookie).toContain("HttpOnly");
    const refreshCookie = responseCookies.find((c: string) => c.startsWith("pj_refresh="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
  });

  it("state is single-use (replay rejected)", async () => {
    const app = await createTestApp();

    const loginRes = await request(app).get("/api/auth/github/login");
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("oauth_state="));
    const stateValue = stateCookie!.split("=")[1].split(";")[0];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("login/oauth/access_token")) {
        return { ok: true, json: async () => ({ access_token: "gho_valid" }) };
      }
      return { ok: true, json: async () => ({ id: 99, login: "user", name: "User", email: "u@test.com" }) };
    });

    // First call succeeds
    const first = await request(app)
      .get(`/api/auth/github/callback?code=code1&state=${stateValue}`)
      .set("Cookie", `oauth_state=${stateValue}`);
    expect(first.status).toBe(302);
    expect(first.headers.location).toBe("http://localhost:3000");

    // Replay rejected
    const replay = await request(app)
      .get(`/api/auth/github/callback?code=code2&state=${stateValue}`)
      .set("Cookie", `oauth_state=${stateValue}`);
    expect(replay.status).toBe(400);
  });
});

// ── Google OAuth ────────────────────────────────────────────────────────────
describe("Google OAuth redirect flow", () => {
  it("GET /api/auth/google/login redirects to Google with correct params", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/auth/google/login");

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location).toContain("client_id=test-google-client-id");
    expect(location).toContain("response_type=code");
    expect(location).toContain("state=");

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("google_oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain("HttpOnly");
  });

  it("completes full Google OAuth flow with refresh token", async () => {
    const app = await createTestApp();

    const loginRes = await request(app).get("/api/auth/google/login");
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("google_oauth_state="));
    const stateValue = stateCookie!.split("=")[1].split(";")[0];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { ok: true, json: async () => ({ access_token: "ya29_mock" }) };
      }
      if (String(url).includes("googleapis.com/oauth2/v2/userinfo")) {
        return { ok: true, json: async () => ({ id: "12345", email: "user@gmail.com", name: "Test User" }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const callbackRes = await request(app)
      .get(`/api/auth/google/callback?code=test-code&state=${stateValue}`)
      .set("Cookie", `google_oauth_state=${stateValue}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("http://localhost:3000");

    const responseCookies = callbackRes.headers["set-cookie"] as unknown as string[];
    expect(responseCookies.find((c: string) => c.startsWith("jwt="))).toBeDefined();
    expect(responseCookies.find((c: string) => c.startsWith("pj_refresh="))).toBeDefined();
  });
});

// ── Microsoft OAuth ─────────────────────────────────────────────────────────
describe("Microsoft OAuth redirect flow", () => {
  it("GET /api/auth/microsoft/login redirects to Microsoft with correct params", async () => {
    const app = await createTestApp();
    const res = await request(app).get("/api/auth/microsoft/login");

    expect(res.status).toBe(302);
    const location = res.headers.location;
    expect(location).toContain("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    expect(location).toContain("client_id=test-microsoft-client-id");
    expect(location).toContain("response_type=code");
    expect(location).toContain("state=");

    const cookies = res.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("microsoft_oauth_state="));
    expect(stateCookie).toBeDefined();
    expect(stateCookie).toContain("HttpOnly");
  });

  it("completes full Microsoft OAuth flow with refresh token", async () => {
    const app = await createTestApp();

    const loginRes = await request(app).get("/api/auth/microsoft/login");
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const stateCookie = cookies.find((c: string) => c.startsWith("microsoft_oauth_state="));
    const stateValue = stateCookie!.split("=")[1].split(";")[0];

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes("login.microsoftonline.com") && String(url).includes("/token")) {
        return { ok: true, json: async () => ({ access_token: "eyJ_mock" }) };
      }
      if (String(url).includes("graph.microsoft.com/v1.0/me")) {
        return { ok: true, json: async () => ({ id: "ms-12345", mail: "user@outlook.com", displayName: "Test User" }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const callbackRes = await request(app)
      .get(`/api/auth/microsoft/callback?code=test-code&state=${stateValue}`)
      .set("Cookie", `microsoft_oauth_state=${stateValue}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe("http://localhost:3000");

    const responseCookies = callbackRes.headers["set-cookie"] as unknown as string[];
    expect(responseCookies.find((c: string) => c.startsWith("jwt="))).toBeDefined();
    expect(responseCookies.find((c: string) => c.startsWith("pj_refresh="))).toBeDefined();
  });
});
