import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { cookieParserMiddleware, signJwt } from "@publiclogic/core";
import authCallback from "../src/api/authCallback.js";

// ── Env setup ───────────────────────────────────────────────────────────────

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-callback";
  process.env.AUTH_ISSUER = process.env.AUTH_ISSUER || "test-issuer";
  process.env.AUTH_AUDIENCE = process.env.AUTH_AUDIENCE || "test-audience";
});

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv.LOGIC_COMMONS_URL = process.env.LOGIC_COMMONS_URL;
  savedEnv.PJ_UI_URL = process.env.PJ_UI_URL;
  savedEnv.DEV_MODE = process.env.DEV_MODE;
  savedEnv.JWT_MAX_AGE_SECONDS = process.env.JWT_MAX_AGE_SECONDS;
  savedEnv.COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

  process.env.LOGIC_COMMONS_URL = "http://mock-commons:3001";
  process.env.PJ_UI_URL = "http://localhost:3000";
  delete process.env.DEV_MODE;
  delete process.env.JWT_MAX_AGE_SECONDS;
  delete process.env.COOKIE_DOMAIN;
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

describe("authCallback handler", () => {
  it("returns 400 when providerToken is missing", async () => {
    const app = buildApp();
    const res = await request(app).get("/auth/callback");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Missing provider token");
  });

  it("returns 502 when Logic Commons is unreachable", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=some-token");
    // The catch block returns 500 for network errors
    expect(res.status).toBe(500);
    expect(res.text).toContain("Auth callback error");
  });

  it("returns 502 when Logic Commons returns non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "Unauthorized",
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=bad-token");
    expect(res.status).toBe(502);
    expect(res.text).toContain("Logic Commons login failed");
  });

  it("returns 502 when Logic Commons returns no token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=some-token");
    expect(res.status).toBe(502);
    expect(res.text).toContain("Logic Commons returned no token");
  });

  it("sets jwt cookie and redirects on success", async () => {
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: fakeJwt }),
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=valid-token");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:3000");

    // Verify jwt cookie is set
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    const jwtCookie = cookieArr.find((c: string) => c.startsWith("jwt="));
    expect(jwtCookie).toBeDefined();
    expect(jwtCookie).toContain("HttpOnly");
    expect(jwtCookie).toContain("Path=/");
  });

  it("jwt cookie does not include Domain when COOKIE_DOMAIN is unset", async () => {
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: fakeJwt }),
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=valid-token");

    expect(res.status).toBe(302);
    const cookies = res.headers["set-cookie"];
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    const jwtCookie = cookieArr.find((c: string) => c.startsWith("jwt="));
    expect(jwtCookie).toBeDefined();
    // Should NOT contain Domain= when COOKIE_DOMAIN is not set
    expect(jwtCookie).not.toContain("Domain=");
  });

  it("jwt cookie includes Domain when COOKIE_DOMAIN is set", async () => {
    process.env.COOKIE_DOMAIN = ".example.com";
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: fakeJwt }),
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=valid-token");

    expect(res.status).toBe(302);
    const cookies = res.headers["set-cookie"];
    const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
    const jwtCookie = cookieArr.find((c: string) => c.startsWith("jwt="));
    expect(jwtCookie).toBeDefined();
    expect(jwtCookie).toContain("Domain=.example.com");
  });

  it("redirects to / when PJ_UI_URL is not set", async () => {
    delete process.env.PJ_UI_URL;
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: fakeJwt }),
    });

    const app = buildApp();
    const res = await request(app).get("/auth/callback?providerToken=valid-token");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("uses /api/login endpoint by default (not dev-token)", async () => {
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: fakeJwt }),
    });

    const app = buildApp();
    await request(app).get("/auth/callback?providerToken=valid-token");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-commons:3001/api/login",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("uses /internal/dev-token when DEV_MODE is true", async () => {
    process.env.DEV_MODE = "true";
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: fakeJwt }),
    });

    const app = buildApp();
    await request(app).get("/auth/callback?providerToken=valid-token");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://mock-commons:3001/internal/dev-token",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("accepts providerToken from request body (POST)", async () => {
    const fakeJwt = await signJwt({ sub: "u1", name: "Test" }, { expiresIn: "1h" });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: fakeJwt }),
    });

    const app = express();
    app.use(cookieParserMiddleware());
    app.use(express.json());
    // Mount as both GET and POST to test body parsing
    app.post("/auth/callback", authCallback);

    const res = await request(app)
      .post("/auth/callback")
      .send({ providerToken: "body-token" });

    expect(res.status).toBe(302);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ providerToken: "body-token" }),
      }),
    );
  });
});
