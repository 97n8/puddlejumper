// ── Token exchange route tests ─────────────────────────────────────────────────
//
// Exercises createTokenExchangeRoutes() HTTP endpoints via supertest.
//
// Route under test (mounted under /api):
//   POST /auth/token-exchange — exchange a provider access token for a PJ session
// ──────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import path from "path";
import os from "os";

// Isolate stores to a temp dir — MUST come before importing stores
const tmpDir = path.join(os.tmpdir(), `lc-token-exchange-${Date.now()}`);
process.env.CONTROLLED_DATA_DIR = tmpDir;

beforeAll(() => {
  process.env.JWT_SECRET = "test-token-exchange-secret-32chars!!";
  process.env.AUTH_ISSUER = "test-issuer";
  process.env.AUTH_AUDIENCE = "test-audience";
});

const { configureRefreshStore } = await import("../src/lib/refresh-store.js");
const { configureAuditStore } = await import("../src/lib/audit-store.js");
const { createTokenExchangeRoutes } = await import("../src/routes/token-exchange.js");
const cookieParser = (await import("cookie-parser")).default;

configureRefreshStore(tmpDir);
configureAuditStore(tmpDir);

// ── Mock provider ──────────────────────────────────────────────────────────

const mockFetchUserInfo = vi.fn();

const mockProvider = {
  name: "microsoft",
  authorizeUrl: "https://example.com/authorize",
  tokenUrl: "https://example.com/token",
  scopes: "openid email profile",
  tokenContentType: "form" as const,
  stateCookieName: "test_state",
  clientIdEnvVar: "TEST_CLIENT_ID",
  clientSecretEnvVar: "TEST_CLIENT_SECRET",
  redirectUriEnvVar: "TEST_REDIRECT_URI",
  defaultRedirectUri: "http://localhost/callback",
  fetchUserInfo: mockFetchUserInfo,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeApp(opts?: { onUserAuthenticated?: any }) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(
    "/api",
    createTokenExchangeRoutes({
      nodeEnv: "test",
      providers: { microsoft: mockProvider },
      onUserAuthenticated: opts?.onUserAuthenticated,
    }),
  );
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetchUserInfo.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/auth/token-exchange", () => {
  it("returns 400 when body is empty", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("returns 400 when provider is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ accessToken: "some-token" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("returns 400 when accessToken is missing", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing required fields");
  });

  it("returns 400 for unsupported provider", async () => {
    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "facebook", accessToken: "tok" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Unsupported provider");
  });

  it("returns 401 when provider token is invalid", async () => {
    mockFetchUserInfo.mockRejectedValue(new Error("Invalid token"));

    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft", accessToken: "bad-token" });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Invalid or expired provider token");
  });

  it("returns 401 when provider returns no user ID", async () => {
    mockFetchUserInfo.mockResolvedValue({ sub: "", email: "a@b.com" });

    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft", accessToken: "tok" });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("Provider returned no user ID");
  });

  it("creates session and returns user on valid token", async () => {
    mockFetchUserInfo.mockResolvedValue({
      sub: "ms-user-123",
      email: "nate@publiclogic.org",
      name: "Nate",
    });

    const app = makeApp();
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft", accessToken: "valid-ms-token" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.sub).toBe("ms-user-123");
    expect(res.body.user.email).toBe("nate@publiclogic.org");
    expect(res.body.user.name).toBe("Nate");
    expect(res.body.user.provider).toBe("microsoft");

    // Verify session cookies are set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    const jwtCookie = cookieArr.find((c: string) => c.startsWith("jwt="));
    const refreshCookie = cookieArr.find((c: string) => c.startsWith("pj_refresh="));
    expect(jwtCookie).toBeDefined();
    expect(refreshCookie).toBeDefined();
    expect(jwtCookie).toContain("HttpOnly");
  });

  it("calls onUserAuthenticated hook when provided", async () => {
    mockFetchUserInfo.mockResolvedValue({
      sub: "ms-user-456",
      email: "allie@publiclogic.org",
      name: "Allie",
    });

    const onUserAuthenticated = vi.fn((userInfo: any) => ({
      ...userInfo,
      role: "admin",
    }));

    const app = makeApp({ onUserAuthenticated });
    const res = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft", accessToken: "valid-ms-token" });

    expect(res.status).toBe(200);
    expect(onUserAuthenticated).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: "ms-user-456",
        email: "allie@publiclogic.org",
        provider: "microsoft",
      }),
    );
  });

  it("rejects empty strings for provider and accessToken", async () => {
    const app = makeApp();

    const res1 = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "  ", accessToken: "tok" });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post("/api/auth/token-exchange")
      .send({ provider: "microsoft", accessToken: "  " });
    expect(res2.status).toBe(400);
  });
});
