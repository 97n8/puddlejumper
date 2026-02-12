import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import request from "supertest";
import { createApp, processAccessNotificationQueueOnce } from "../src/api/server.js";
import { PrrStore } from "../src/api/prrStore.js";
import { sha256 } from "../src/engine/hashing.js";

const TMP_DB = path.join(process.cwd(), "data", `server-idempotency-${Date.now()}.db`);
const AUTH_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const AUTH_ISSUER = "puddle-jumper-test";
const AUTH_AUDIENCE = "puddle-jumper-api-test";
const REQUEST_MARKER_HEADER = "X-PuddleJumper-Request";
const LOGIN_PASSWORD = "admin";
const LOGIN_PASSWORD_HASH = bcrypt.hashSync(LOGIN_PASSWORD, 10);
const RATE_LIMIT_DB_PATHS = new Set<string>();
const PRR_DB_PATHS = new Set<string>();
const CONNECTOR_DB_PATHS = new Set<string>();
const RUNTIME_CONTEXT = {
  workspace: {
    id: "ws-live",
    name: "Operations Workspace",
    charter: {
      authority: true,
      accountability: true,
      boundary: true,
      continuity: true
    }
  },
  municipality: {
    id: "mun-live",
    name: "LiveTown",
    state: "MA",
    population: 1234,
    statutes: {
      records: "MGL Ch. 66 Section 10"
    },
    policies: {
      governance: { text: "Live policy" }
    },
    risk_profile: {
      strict_mode: true
    }
  },
  actionDefaults: {
    mode: "launch",
    intent: "health_check",
    targets: ["health:system"],
    environment: "production",
    description: "Runtime default action"
  }
};
const RUNTIME_TILES = [
  {
    id: "deploy",
    label: "Deploy",
    icon: "D",
    mode: "governed",
    intent: "deploy_policy",
    target: "github:live/repo",
    tone: "primary",
    description: "Deploy to live environment"
  }
];
const RUNTIME_CAPABILITIES = {
  automations: [
    {
      type: "automation",
      id: "live-health",
      title: "Live Health Check",
      icon: "H",
      desc: "Checks live connectors",
      tags: ["OPS"],
      status: "active"
    }
  ],
  quickActions: [
    {
      type: "action",
      trigger: ["health"],
      title: "Run Health",
      icon: "Q",
      desc: "Run health verification",
      hint: "Live action"
    }
  ]
};

type CanonicalRef = { url: string; sha: string };

function authToken(
  claims: Partial<{
    sub: string;
    name: string;
    role: string;
    permissions: string[];
    tenantId: string;
    tenants: Array<{ id: string; name: string; sha: string; connections: string[] }>;
  }> = {},
  expiresIn: SignOptions["expiresIn"] = "5m"
): string {
  return jwt.sign(
    {
      sub: "user-1",
      name: "Taylor Adams",
      role: "admin",
      permissions: ["deploy", "notify", "archive", "seal"],
      tenantId: "town",
      tenants: [{ id: "town", name: "Town", sha: "abc123", connections: ["SharePoint", "GitHub"] }],
      ...claims
    },
    AUTH_SECRET,
    {
      algorithm: "HS256",
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
      expiresIn
    }
  );
}

function governedPayload(requestId: string, canonical?: CanonicalRef) {
  return {
    workspace: {
      id: "town",
      name: "Policy Ops",
      charter: {
        authority: true,
        accountability: true,
        boundary: true,
        continuity: true
      }
    },
    municipality: {
      id: "mun-2",
      name: "Ashfield",
      state: "MA",
      population: 2000,
      statutes: {
        zoning: "MGL Ch. 40A Section 5"
      },
      policies: {
        governance: { text: "Policy changes must be auditable" }
      },
      risk_profile: {
        strict_mode: false
      }
    },
    operator: {
      id: "op-2",
      name: "Jordan",
      role: "Clerk",
      permissions: ["deploy"],
      delegations: []
    },
    action: {
      mode: "governed",
      trigger: {
        type: "form",
        reference: "policy-form-1",
        evidence: {
          statuteKey: "zoning",
          policyKey: "governance"
        }
      },
      intent: "deploy_policy",
      targets: ["sharepoint:town:/drive/root:/records/policy", "github:town/town-ops"],
      environment: "production",
      metadata: {
        description: "Deploy revised parking policy",
        archieve: {
          dept: "clerk",
          type: "policy",
          date: "2026-02-11",
          seq: 2,
          v: 1
        },
        deployMode: "pr",
        ...(canonical ? { canonicalUrl: canonical.url, canonicalSha: canonical.sha } : {})
      },
      requestId
    },
    timestamp: "2026-02-11T12:00:00Z"
  };
}

function createSecuredAppBundle(
  overrides: Parameters<typeof createApp>[1] = {},
  settings: { rateLimitDbPath?: string } = {}
) {
  const rateLimitDbPath =
    settings.rateLimitDbPath ??
    path.join(process.cwd(), "data", `server-rate-limit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`);
  process.env.IDEMPOTENCY_DB_PATH = TMP_DB;
  process.env.RATE_LIMIT_DB_PATH = rateLimitDbPath;
  const connectorDbPath = path.join(
    process.cwd(),
    "data",
    `server-connectors-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`
  );
  const prrDbPath = path.join(
    process.cwd(),
    "data",
    `server-prr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`
  );
  process.env.PRR_DB_PATH = prrDbPath;
  process.env.CONNECTOR_DB_PATH = connectorDbPath;
  process.env.CONNECTOR_STATE_SECRET = AUTH_SECRET;
  process.env.ALLOW_ADMIN_LOGIN = "true";
  process.env.PJ_LOGIN_USERS_JSON = JSON.stringify([
    {
      id: "dev-admin",
      username: "admin",
      passwordHash: LOGIN_PASSWORD_HASH,
      name: "Development Admin",
      role: "admin",
      permissions: ["deploy", "notify", "archive", "seal"],
      tenants: [{ id: "tenant-dev", name: "Development", sha: "dev-sha", connections: ["GitHub", "SharePoint"] }],
      tenantId: "tenant-dev"
    }
  ]);
  process.env.PJ_RUNTIME_CONTEXT_JSON = JSON.stringify(RUNTIME_CONTEXT);
  process.env.PJ_RUNTIME_TILES_JSON = JSON.stringify(RUNTIME_TILES);
  process.env.PJ_RUNTIME_CAPABILITIES_JSON = JSON.stringify(RUNTIME_CAPABILITIES);
  RATE_LIMIT_DB_PATHS.add(rateLimitDbPath);
  PRR_DB_PATHS.add(prrDbPath);
  CONNECTOR_DB_PATHS.add(connectorDbPath);
  const app = createApp("development", {
    authOptions: {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
      jwtSecret: AUTH_SECRET
    },
    ...overrides
  });
  return { app, prrDbPath, rateLimitDbPath };
}

function createSecuredApp(
  overrides: Parameters<typeof createApp>[1] = {},
  settings: { rateLimitDbPath?: string } = {}
) {
  return createSecuredAppBundle(overrides, settings).app;
}

test("security headers are set on responses", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.equal(String(response.headers["x-content-type-options"] ?? "").toLowerCase(), "nosniff");
  assert.equal(response.headers["x-frame-options"], undefined);
  assert.match(String(response.headers["content-security-policy"] ?? ""), /default-src 'self'/);
  assert.match(String(response.headers["content-security-policy"] ?? ""), /frame-ancestors 'self'/);
  assert.match(String(response.headers["content-security-policy"] ?? ""), /http:\/\/localhost:3000/);
  assert.doesNotMatch(String(response.headers["content-security-policy"] ?? ""), /'unsafe-inline'/);
});

test("GET /pj-workspace allows trusted parent origins in connect-src", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/pj-workspace");
  assert.equal(response.status, 200);
  const csp = String(response.headers["content-security-policy"] ?? "");
  assert.match(csp, /connect-src 'self' http:\/\/localhost:3000 http:\/\/127\.0\.0\.1:3000/);
});

test("CORS preflight allows trusted localhost origin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .options("/api/pj/identity-token")
    .set("Origin", "http://localhost:3000")
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "authorization,x-puddlejumper-request");

  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], "http://localhost:3000");
  assert.equal(response.headers["access-control-allow-credentials"], "true");
  assert.match(String(response.headers["access-control-allow-methods"] ?? ""), /GET/);
});

test("CORS preflight denies unknown origin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .options("/api/pj/identity-token")
    .set("Origin", "http://evil.example")
    .set("Access-Control-Request-Method", "GET");

  assert.equal(response.status, 403);
});

test("CORS preflight allows trusted https localhost origin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .options("/api/pj/identity-token")
    .set("Origin", "https://localhost:3000")
    .set("Access-Control-Request-Method", "GET");

  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], "https://localhost:3000");
  assert.equal(response.headers["access-control-allow-credentials"], "true");
});

test("canonical integrity is enforced by engine boundary, not API route layer", () => {
  const serverSource = fs.readFileSync(path.join(process.cwd(), "src", "api", "server.ts"), "utf8");
  const engineSource = fs.readFileSync(path.join(process.cwd(), "src", "engine", "governanceEngine.ts"), "utf8");
  assert.doesNotMatch(serverSource, /verifyCanonicalPlan|fetchCanonicalJsonDocument/);
  assert.match(engineSource, /verifyCanonicalPlan/);
  assert.match(engineSource, /fetchCanonicalJsonDocument/);
});

test("spoofed x-user headers are ignored and request fails without JWT", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/identity")
    .set("x-session-authenticated", "true")
    .set("x-user-name", "attacker")
    .set("x-user-role", "admin");
  assert.equal(response.status, 401);
});

test("GET /api/identity returns 401 when JWT is missing", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/api/identity");
  assert.equal(response.status, 401);
});

test("GET /api/identity returns 401 for expired token", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/identity")
    .set("Authorization", `Bearer ${authToken({}, -10)}`);
  assert.equal(response.status, 401);
});

test("GET /api/prompt returns 403 for authenticated non-admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/prompt")
    .set("Authorization", `Bearer ${authToken({ role: "operator" })}`);
  assert.equal(response.status, 403);
});

test("GET /api/prompt returns prompt for authenticated admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/prompt")
    .set("Authorization", `Bearer ${authToken({ role: "admin" })}`);
  assert.equal(response.status, 200);
  assert.equal(typeof response.body?.content, "string");
  assert.ok(String(response.body.content).length > 100);
});

test("GET /api/core-prompt returns summary contract for authenticated non-admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/core-prompt")
    .set("Authorization", `Bearer ${authToken({ role: "operator" })}`);

  assert.equal(response.status, 200);
  assert.equal(response.body?.mode, "summary");
  assert.equal(response.body?.editable, false);
  assert.equal(response.body?.redacted, true);
  assert.equal(typeof response.body?.content, "string");
  assert.ok(String(response.body?.content ?? "").length > 0);
});

test("GET /api/core-prompt returns full contract for authenticated admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/core-prompt")
    .set("Authorization", `Bearer ${authToken({ role: "admin" })}`);

  assert.equal(response.status, 200);
  assert.equal(response.body?.mode, "full");
  assert.equal(response.body?.editable, true);
  assert.equal(response.body?.redacted, false);
  assert.equal(typeof response.body?.content, "string");
  assert.ok(String(response.body?.content ?? "").length > 100);
});

test("POST /api/login issues HttpOnly session cookie and cookie can call protected route", async () => {
  const app = createSecuredApp();
  const agent = request.agent(app);
  const login = await agent
    .post("/api/login")
    .send({ username: "admin", password: LOGIN_PASSWORD });

  assert.equal(login.status, 200);
  const setCookie = Array.isArray(login.headers["set-cookie"]) ? login.headers["set-cookie"] : [];
  assert.ok(setCookie.some((cookie) => /^jwt=/.test(cookie)));
  assert.ok(setCookie.some((cookie) => /HttpOnly/i.test(cookie)));
  assert.ok(setCookie.some((cookie) => /SameSite=Lax/i.test(cookie)));

  const identity = await agent.get("/api/identity");
  assert.equal(identity.status, 200);
  assert.equal(identity.body?.role, "admin");
});

test("POST /api/login rejects unknown fields", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/login")
    .send({ username: "admin", password: LOGIN_PASSWORD, role: "admin" });

  assert.equal(response.status, 400);
  assert.match(String(response.body?.error ?? ""), /invalid request payload/i);
});

test("production startup fails when ALLOW_ADMIN_LOGIN is true", () => {
  process.env.ALLOW_ADMIN_LOGIN = "true";
  process.env.PRR_DB_PATH = path.join(process.cwd(), "data", "prod-prr.db");
  assert.throws(() =>
    createApp("production", {
      authOptions: {
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
        jwtSecret: AUTH_SECRET
      }
    })
  );
});

test("production startup fails when runtime config is missing", () => {
  process.env.ALLOW_ADMIN_LOGIN = "false";
  process.env.PRR_DB_PATH = path.join(process.cwd(), "data", "prod-prr.db");
  delete process.env.PJ_RUNTIME_CONTEXT_JSON;
  delete process.env.PJ_RUNTIME_TILES_JSON;
  delete process.env.PJ_RUNTIME_CAPABILITIES_JSON;
  assert.throws(() =>
    createApp("production", {
      authOptions: {
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
        jwtSecret: AUTH_SECRET
      }
    })
  );
});

test("production startup fails when critical db paths are missing", () => {
  process.env.ALLOW_ADMIN_LOGIN = "false";
  process.env.PJ_RUNTIME_CONTEXT_JSON = JSON.stringify(RUNTIME_CONTEXT);
  process.env.PJ_RUNTIME_TILES_JSON = JSON.stringify(RUNTIME_TILES);
  process.env.PJ_RUNTIME_CAPABILITIES_JSON = JSON.stringify(RUNTIME_CAPABILITIES);
  delete process.env.PRR_DB_PATH;
  delete process.env.IDEMPOTENCY_DB_PATH;
  delete process.env.RATE_LIMIT_DB_PATH;
  assert.throws(() =>
    createApp("production", {
      authOptions: {
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE,
        jwtSecret: AUTH_SECRET
      }
    })
  );
});

test("production startup fails when jwt key is missing", () => {
  process.env.ALLOW_ADMIN_LOGIN = "false";
  process.env.PJ_RUNTIME_CONTEXT_JSON = JSON.stringify(RUNTIME_CONTEXT);
  process.env.PJ_RUNTIME_TILES_JSON = JSON.stringify(RUNTIME_TILES);
  process.env.PJ_RUNTIME_CAPABILITIES_JSON = JSON.stringify(RUNTIME_CAPABILITIES);
  process.env.PRR_DB_PATH = path.join(process.cwd(), "data", "prod-prr.db");
  process.env.IDEMPOTENCY_DB_PATH = path.join(process.cwd(), "data", "prod-idempotency.db");
  process.env.RATE_LIMIT_DB_PATH = path.join(process.cwd(), "data", "prod-rate-limit.db");
  assert.throws(() =>
    createApp("production", {
      authOptions: {
        issuer: AUTH_ISSUER,
        audience: AUTH_AUDIENCE
      }
    })
  );
});

test("POST /api/login is rate limited", async () => {
  const app = createSecuredApp();
  let lastStatus = 0;
  for (let index = 0; index < 11; index += 1) {
    const response = await request(app)
      .post("/api/login")
      .send({ username: "admin", password: "wrong-password" });
    lastStatus = response.status;
  }
  assert.equal(lastStatus, 429);
});

test("POST /api/login rate limit persists across app restart with shared durable store", async () => {
  const sharedRateDbPath = path.join(process.cwd(), "data", `server-rate-shared-${Date.now()}.db`);
  RATE_LIMIT_DB_PATHS.add(sharedRateDbPath);
  const appA = createSecuredApp({}, { rateLimitDbPath: sharedRateDbPath });
  for (let index = 0; index < 10; index += 1) {
    await request(appA)
      .post("/api/login")
      .send({ username: "admin", password: "wrong-password" });
  }

  const appB = createSecuredApp({}, { rateLimitDbPath: sharedRateDbPath });
  const response = await request(appB)
    .post("/api/login")
    .send({ username: "admin", password: "wrong-password" });
  assert.equal(response.status, 429);
});

test("POST /api/logout clears session cookie", async () => {
  const app = createSecuredApp();
  const agent = request.agent(app);
  await agent.post("/api/login").send({ username: "admin", password: LOGIN_PASSWORD });

  const logout = await agent.post("/api/logout").set(REQUEST_MARKER_HEADER, "true");
  assert.equal(logout.status, 200);
  const setCookie = Array.isArray(logout.headers["set-cookie"]) ? logout.headers["set-cookie"] : [];
  assert.ok(setCookie.some((cookie) => /^jwt=;/.test(cookie)));
});

test("GET /api/prompt is rate limited", async () => {
  const app = createSecuredApp();
  const token = authToken({ role: "admin" });
  let lastStatus = 0;
  for (let index = 0; index < 21; index += 1) {
    const response = await request(app).get("/api/prompt").set("Authorization", `Bearer ${token}`);
    lastStatus = response.status;
  }
  assert.equal(lastStatus, 429);
});

test("GET /api/identity returns token-derived identity (not spoofed header values)", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/identity")
    .set(
      "Authorization",
      `Bearer ${authToken({
        sub: "verified-user",
        name: "Verified User",
        role: "admin",
        tenants: [{ id: "tenant-z", name: "Shelburne", sha: "ff00", connections: ["GitHub"] }]
      })}`
    )
    .set("x-user-name", "Spoofed Name")
    .set("x-user-role", "owner");

  assert.equal(response.status, 200);
  assert.equal(response.body?.name, "Verified User");
  assert.equal(response.body?.role, "admin");
  assert.equal(response.body?.tenants?.[0]?.id, "tenant-z");
});

test("GET /api/runtime/context returns authenticated runtime context", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/runtime/context")
    .set("Authorization", `Bearer ${authToken()}`);
  assert.equal(response.status, 200);
  assert.equal(response.body?.workspace?.id, "ws-live");
  assert.equal(response.body?.municipality?.id, "mun-live");
  assert.equal(response.body?.operator?.id, "user-1");
});

test("GET /api/config/tiles returns runtime tiles", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/config/tiles")
    .set("Authorization", `Bearer ${authToken()}`);
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
  assert.equal(response.body?.[0]?.id, "deploy");
});

test("GET /api/config/capabilities returns runtime capabilities", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/config/capabilities")
    .set("Authorization", `Bearer ${authToken()}`);
  assert.equal(response.status, 200);
  assert.equal(response.body?.automations?.[0]?.id, "live-health");
  assert.equal(response.body?.quickActions?.[0]?.title, "Run Health");
});

test("GET /api/capabilities/manifest returns capability contract for admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/capabilities/manifest")
    .set("Authorization", `Bearer ${authToken({ role: "admin", permissions: ["deploy"] })}`);

  assert.equal(response.status, 200);
  assert.equal(typeof response.body?.userId, "string");
  assert.equal(response.body?.tenantId, "town");
  assert.equal(response.body?.capabilities?.["corePrompt.read"], true);
  assert.equal(response.body?.capabilities?.["corePrompt.edit"], true);
  assert.equal(response.body?.capabilities?.["evaluate.execute"], true);
  assert.equal(response.body?.capabilities?.["missionControl.tiles.read"], true);
  assert.equal(response.body?.capabilities?.["missionControl.tiles.customize"], true);
  assert.equal(response.body?.capabilities?.["missionControl.capabilities.read"], true);
  assert.equal(response.body?.capabilities?.["popout.launch"], true);
  assert.equal("role" in (response.body ?? {}), false);
});

test("GET /api/capabilities/manifest returns restricted contract for non-admin", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/capabilities/manifest")
    .set("Authorization", `Bearer ${authToken({ role: "operator", permissions: ["notify"] })}`);

  assert.equal(response.status, 200);
  assert.equal(response.body?.capabilities?.["corePrompt.read"], true);
  assert.equal(response.body?.capabilities?.["corePrompt.edit"], false);
  assert.equal(response.body?.capabilities?.["evaluate.execute"], false);
  assert.equal(response.body?.capabilities?.["missionControl.tiles.read"], true);
  assert.equal(response.body?.capabilities?.["missionControl.tiles.customize"], false);
  assert.equal(response.body?.capabilities?.["missionControl.capabilities.read"], true);
  assert.equal(response.body?.capabilities?.["popout.launch"], true);
});

test("GET /api/capabilities/manifest returns 401 when unauthenticated", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/api/capabilities/manifest");
  assert.equal(response.status, 401);
});

test("GET /api/connectors returns tenant-scoped provider statuses", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/connectors")
    .set("Authorization", `Bearer ${authToken()}`);

  assert.equal(response.status, 200);
  assert.equal(response.body?.tenantId, "town");
  assert.equal(response.body?.userId, "user-1");
  assert.equal(response.body?.connectors?.microsoft?.provider, "microsoft");
  assert.equal(response.body?.connectors?.google?.provider, "google");
  assert.equal(response.body?.connectors?.github?.provider, "github");
  assert.equal(response.body?.connectors?.microsoft?.connected, false);
  assert.equal(response.body?.connectors?.google?.connected, false);
  assert.equal(response.body?.connectors?.github?.connected, false);
});

test("POST /api/connectors/:provider/auth/start validates provider and configuration", async () => {
  const app = createSecuredApp();
  const invalidProviderResponse = await request(app)
    .post("/api/connectors/not-a-provider/auth/start")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send({});

  assert.equal(invalidProviderResponse.status, 400);

  const originalClientId = process.env.MS_CLIENT_ID;
  const originalClientSecret = process.env.MS_CLIENT_SECRET;
  delete process.env.MS_CLIENT_ID;
  delete process.env.MS_CLIENT_SECRET;

  const unavailableResponse = await request(app)
    .post("/api/connectors/microsoft/auth/start")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send({});

  if (typeof originalClientId === "string") {
    process.env.MS_CLIENT_ID = originalClientId;
  }
  if (typeof originalClientSecret === "string") {
    process.env.MS_CLIENT_SECRET = originalClientSecret;
  }

  assert.equal(unavailableResponse.status, 503);
  assert.match(String(unavailableResponse.body?.error ?? ""), /not configured/i);
});

test("GET /api/connectors/:provider/auth/callback rejects invalid state", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/api/connectors/microsoft/auth/callback?code=abc&state=bad");
  assert.equal(response.status, 400);
  assert.match(String(response.text ?? ""), /invalid or expired state/i);
});

test("GET /api/connectors/:provider/resources returns 401 when provider is not connected", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/connectors/google/resources?q=test")
    .set("Authorization", `Bearer ${authToken()}`);

  assert.equal(response.status, 401);
  assert.match(String(response.body?.error ?? ""), /not connected/i);
});

test("GET /api/pj/actions returns allowed control actions for deploy-capable user", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/pj/actions")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"], role: "admin" })}`);

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
  const actionIds = response.body.map((entry: { id: string }) => entry.id).sort();
  assert.deepEqual(actionIds, [
    "environment.create",
    "environment.promote",
    "environment.snapshot",
    "environment.update"
  ]);
});

test("GET /api/pj/actions returns empty array when capability requirements are not met", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/pj/actions")
    .set("Authorization", `Bearer ${authToken({ permissions: ["notify"], role: "operator" })}`);

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
  assert.equal(response.body.length, 0);
});

test("GET /api/pj/identity-token returns 401 when unauthenticated", async () => {
  const app = createSecuredApp();
  const response = await request(app).get("/api/pj/identity-token");
  assert.equal(response.status, 401);
});

test("GET /api/pj/identity-token exchanges trusted Microsoft Graph token when session is absent", async () => {
  const graphFetch: typeof fetch = (async (input, init) => {
    assert.equal(String(input), "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName");
    const headers = init?.headers as Record<string, string> | undefined;
    assert.equal(typeof headers?.Authorization, "string");
    assert.equal(headers?.Authorization, "Bearer graph-access-token");
    return new Response(
      JSON.stringify({
        id: "ms-user-1",
        displayName: "Alex Operator",
        userPrincipalName: "alex.operator@publiclogic.org"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }) as typeof fetch;

  const app = createSecuredApp({
    msGraphFetchImpl: graphFetch
  });
  const tokenResponse = await request(app)
    .get("/api/pj/identity-token")
    .set("X-MS-Graph-Token", "graph-access-token");

  assert.equal(tokenResponse.status, 200);
  assert.equal(tokenResponse.body?.token_type, "Bearer");
  assert.equal(typeof tokenResponse.body?.token, "string");

  const identityResponse = await request(app)
    .get("/api/identity")
    .set("Authorization", `Bearer ${tokenResponse.body.token}`);
  assert.equal(identityResponse.status, 200);
  assert.equal(identityResponse.body?.name, "Alex Operator");
  assert.equal(Array.isArray(identityResponse.body?.tenants), true);
  assert.equal(identityResponse.body?.tenants?.[0]?.id, "ws-live");
});

test("GET /api/pj/identity-token returns short-lived bearer token for authenticated user", async () => {
  const app = createSecuredApp();
  const tokenResponse = await request(app)
    .get("/api/pj/identity-token")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"], role: "admin" })}`);

  assert.equal(tokenResponse.status, 200);
  assert.equal(tokenResponse.body?.token_type, "Bearer");
  assert.equal(typeof tokenResponse.body?.token, "string");
  assert.equal(tokenResponse.body?.expires_in, 900);
  assert.equal(typeof tokenResponse.body?.expires_at, "string");
  assert.equal(typeof tokenResponse.body?.correlationId, "string");
  assert.match(String(tokenResponse.body?.correlationId ?? ""), /^[0-9a-f-]{36}$/i);
  const expiresAtMs = Date.parse(String(tokenResponse.body?.expires_at ?? ""));
  assert.equal(Number.isFinite(expiresAtMs), true);
  assert.ok(expiresAtMs > Date.now());

  const identityResponse = await request(app)
    .get("/api/identity")
    .set("Authorization", `${tokenResponse.body.token_type} ${tokenResponse.body.token}`);
  assert.equal(identityResponse.status, 200);
  assert.equal(identityResponse.body?.name, "Taylor Adams");
  assert.equal(identityResponse.body?.role, "admin");
});

test("POST /api/pj/execute routes environment.create through authoritative engine path", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/pj/execute")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"], role: "admin" })}`)
    .send({
      actionId: "environment.create",
      payload: {
        name: "Phillipston Production",
        config: { region: "us-east-1", retention: { policy: "default" } }
      },
      mode: "execute"
    });

  assert.equal(response.status, 200);
  assert.equal(response.body?.success, true);
  assert.equal(response.body?.data?.actionId, "environment.create");
  assert.equal(typeof response.body?.data?.id, "string");
  assert.equal(typeof response.body?.data?.decision?.auditRecord?.eventId, "string");
});

test("POST /api/pj/execute returns 403 for users lacking execute capability", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/pj/execute")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken({ permissions: ["notify"], role: "operator" })}`)
    .send({
      actionId: "environment.update",
      payload: {
        environmentId: "env-1",
        patch: { region: "us-east-2" }
      },
      mode: "execute"
    });

  assert.equal(response.status, 403);
  assert.equal(response.body?.success, false);
  assert.match(String(response.body?.error ?? ""), /forbidden/i);
});

test("POST /api/pj/execute dry-run does not persist idempotency rows", async () => {
  const app = createSecuredApp();
  const requestId = `pj-dry-${Date.now()}`;
  const response = await request(app)
    .post("/api/pj/execute")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"], role: "admin" })}`)
    .send({
      actionId: "environment.snapshot",
      payload: {
        environmentId: "env-main",
        requestId
      },
      mode: "dry-run"
    });

  assert.equal(response.status, 200);
  assert.equal(response.body?.success, true);

  const db = new Database(TMP_DB, { readonly: true });
  const scopedId = `user-1:town:${requestId}`;
  const row = db
    .prepare("SELECT request_id FROM idempotency WHERE request_id = ?")
    .get(scopedId) as { request_id: string } | undefined;
  db.close();

  assert.equal(row, undefined);
});

test("POST /api/prr/intake stores server timestamp, statutory due date, and intake audit", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const response = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_name: "Jane Doe",
      requester_email: "jane@example.org",
      subject: "All emails about route plan",
      description: "Please include related attachments.",
      received_at: "1900-01-01T00:00:00.000Z"
    });

  assert.equal(response.status, 400);
  assert.match(String(response.body?.error ?? ""), /invalid request payload/i);

  const created = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_name: "Jane Doe",
      requester_email: "jane@example.org",
      subject: "All emails about route plan",
      description: "Please include related attachments."
    });
  assert.equal(created.status, 201);
  assert.equal(created.body?.status, "received");
  assert.equal(typeof created.body?.id, "string");
  assert.equal(typeof created.body?.public_id, "string");
  assert.match(String(created.body?.public_id ?? ""), /^[0-9a-f-]{36}$/i);
  assert.equal(created.body?.tracking_url, `/api/public/prrs/${created.body?.public_id}`);
  assert.equal(typeof created.body?.received_at, "string");
  assert.equal(typeof created.body?.statutory_due_at, "string");

  const db = new Database(prrDbPath, { readonly: true });
  const prrRow = db
    .prepare("SELECT tenant_id, status, received_at, statutory_due_at, public_id FROM prr WHERE id = ?")
    .get(created.body.id) as
    | { tenant_id: string; status: string; received_at: string; statutory_due_at: string; public_id: string | null }
    | undefined;
  const auditRow = db
    .prepare("SELECT action, actor_user_id, to_status FROM prr_audit WHERE prr_id = ? ORDER BY id ASC LIMIT 1")
    .get(created.body.id) as { action: string; actor_user_id: string; to_status: string | null } | undefined;
  db.close();

  assert.ok(prrRow);
  assert.equal(prrRow?.tenant_id, "town");
  assert.equal(prrRow?.status, "received");
  assert.equal(prrRow?.received_at, created.body.received_at);
  assert.equal(prrRow?.statutory_due_at, created.body.statutory_due_at);
  assert.equal(prrRow?.public_id, created.body.public_id);

  assert.ok(auditRow);
  assert.equal(auditRow?.action, "intake");
  assert.equal(auditRow?.actor_user_id, "public");
  assert.equal(auditRow?.to_status, "received");
});

test("GET /api/public/prrs/:publicId returns public-safe tracking payload", async () => {
  const app = createSecuredApp();
  const created = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_name: "Jane Doe",
      requester_email: "jane@example.org",
      subject: "Records request",
      description: "Need records for route planning decisions."
    });
  assert.equal(created.status, 201);
  const publicId = String(created.body?.public_id ?? "");
  assert.ok(publicId);

  const tracked = await request(app).get(`/api/public/prrs/${publicId}`);
  assert.equal(tracked.status, 200);
  assert.equal(tracked.body?.tracking_id, publicId);
  assert.equal(typeof tracked.body?.received_at, "string");
  assert.equal(typeof tracked.body?.status, "string");
  assert.equal(typeof tracked.body?.due_date, "string");
  assert.equal(typeof tracked.body?.summary, "string");
  assert.equal(typeof tracked.body?.agency, "string");
  assert.equal("tenant_id" in (tracked.body ?? {}), false);
});

test("authenticated intake ignores payload tenantId and uses actor tenant", async () => {
  const app = createSecuredApp();
  const token = authToken({
    sub: "rao-user-tenant",
    tenantId: "town",
    permissions: ["deploy"]
  });
  const created = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({
      tenantId: "other-tenant",
      subject: "Tenant containment check"
    });
  assert.equal(created.status, 201);

  const list = await request(app)
    .get("/api/prr")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(Array.isArray(list.body?.items), true);
  assert.equal(list.body.items.some((item: { id: string }) => item.id === created.body.id), true);
});

test("PRR status endpoint enforces allowed transitions and writes audit", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const token = authToken({
    sub: "rao-user-1",
    tenantId: "town",
    permissions: ["deploy"]
  });

  const created = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({
      requester_name: "Joe Public",
      requester_email: "joe@example.org",
      subject: "PRR transit logs"
    });
  assert.equal(created.status, 201);

  const advance = await request(app)
    .post(`/api/prr/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "acknowledged" });
  assert.equal(advance.status, 200);
  assert.equal(advance.body?.status, "acknowledged");

  const disallowed = await request(app)
    .post(`/api/prr/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "closed" });
  assert.equal(disallowed.status, 409);
  assert.match(String(disallowed.body?.error ?? ""), /invalid status transition/i);

  const db = new Database(prrDbPath, { readonly: true });
  const transitions = db
    .prepare(
      "SELECT action, actor_user_id, from_status, to_status FROM prr_audit WHERE prr_id = ? ORDER BY id ASC"
    )
    .all(created.body.id) as Array<{ action: string; actor_user_id: string; from_status: string | null; to_status: string | null }>;
  db.close();

  assert.equal(transitions.length, 2);
  assert.equal(transitions[1]?.action, "status_change");
  assert.equal(transitions[1]?.actor_user_id, "rao-user-1");
  assert.equal(transitions[1]?.from_status, "received");
  assert.equal(transitions[1]?.to_status, "acknowledged");
});

test("POST /api/prr/:id/close sets closed_at + disposition and writes close audit", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const token = authToken({
    sub: "rao-user-2",
    tenantId: "town",
    permissions: ["deploy"]
  });

  const created = await request(app)
    .post("/api/prr/intake")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({
      subject: "PRR payroll records"
    });
  assert.equal(created.status, 201);

  const toAcknowledged = await request(app)
    .post(`/api/prr/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "acknowledged" });
  assert.equal(toAcknowledged.status, 200);

  const toInProgress = await request(app)
    .post(`/api/prr/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "in_progress" });
  assert.equal(toInProgress.status, 200);

  const closed = await request(app)
    .post(`/api/prr/${created.body.id}/close`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ disposition: "fulfilled" });
  assert.equal(closed.status, 200);
  assert.equal(closed.body?.status, "closed");
  assert.equal(closed.body?.disposition, "fulfilled");
  assert.equal(typeof closed.body?.closed_at, "string");

  const db = new Database(prrDbPath, { readonly: true });
  const finalRow = db
    .prepare("SELECT status, closed_at, disposition FROM prr WHERE id = ?")
    .get(created.body.id) as { status: string; closed_at: string | null; disposition: string | null } | undefined;
  const closeAudit = db
    .prepare(
      "SELECT action, actor_user_id, from_status, to_status FROM prr_audit WHERE prr_id = ? AND action = 'close' ORDER BY id DESC LIMIT 1"
    )
    .get(created.body.id) as
    | { action: string; actor_user_id: string; from_status: string | null; to_status: string | null }
    | undefined;
  db.close();

  assert.ok(finalRow);
  assert.equal(finalRow?.status, "closed");
  assert.equal(typeof finalRow?.closed_at, "string");
  assert.equal(finalRow?.disposition, "fulfilled");

  assert.ok(closeAudit);
  assert.equal(closeAudit?.action, "close");
  assert.equal(closeAudit?.actor_user_id, "rao-user-2");
  assert.equal(closeAudit?.from_status, "in_progress");
  assert.equal(closeAudit?.to_status, "closed");
});

test("POST /api/access/request stores immutable intake fields and queues notification", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const invalid = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_email: "operator@town.example.org",
      requested_role: "Clerk",
      justification: "Needs access for records governance workflows.",
      received_at: "1900-01-01T00:00:00.000Z"
    });
  assert.equal(invalid.status, 400);
  assert.match(String(invalid.body?.error ?? ""), /invalid request payload/i);

  const created = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_name: "Jane Doe",
      requester_email: "operator@town.example.org",
      organization: "Town of Phillipston",
      requested_role: "Clerk",
      system: "PuddleJumper",
      justification: "Needs access for records governance workflows."
    });
  assert.equal(created.status, 201);
  assert.equal(typeof created.body?.id, "string");
  assert.match(String(created.body?.case_id ?? ""), /^AR-\d{8}-[A-Z0-9]{8}$/);
  assert.equal(created.body?.tenantId, "town");
  assert.equal(created.body?.status, "received");
  assert.equal(created.body?.notification?.target, "info@publiclogic.org");
  assert.equal(created.body?.notification?.status, "queued");

  const db = new Database(prrDbPath, { readonly: true });
  const accessRow = db
    .prepare(
      "SELECT tenant_id, requester_email, requested_role, status, received_at, requested_by_user_id FROM access_request WHERE id = ?"
    )
    .get(created.body.id) as
    | {
        tenant_id: string;
        requester_email: string;
        requested_role: string;
        status: string;
        received_at: string;
        requested_by_user_id: string | null;
      }
    | undefined;
  const auditRow = db
    .prepare(
      "SELECT action, actor_user_id, to_status FROM access_request_audit WHERE access_request_id = ? ORDER BY id ASC LIMIT 1"
    )
    .get(created.body.id) as { action: string; actor_user_id: string; to_status: string | null } | undefined;
  const notificationRow = db
    .prepare(
      "SELECT target_email, status FROM access_request_notification WHERE access_request_id = ? ORDER BY id ASC LIMIT 1"
    )
    .get(created.body.id) as { target_email: string; status: string } | undefined;
  db.close();

  assert.ok(accessRow);
  assert.equal(accessRow?.tenant_id, "town");
  assert.equal(accessRow?.requester_email, "operator@town.example.org");
  assert.equal(accessRow?.requested_role, "Clerk");
  assert.equal(accessRow?.status, "received");
  assert.equal(accessRow?.received_at, created.body.received_at);
  assert.equal(accessRow?.requested_by_user_id, "public");

  assert.ok(auditRow);
  assert.equal(auditRow?.action, "intake");
  assert.equal(auditRow?.actor_user_id, "public");
  assert.equal(auditRow?.to_status, "received");

  assert.ok(notificationRow);
  assert.equal(notificationRow?.target_email, "info@publiclogic.org");
  assert.equal(notificationRow?.status, "queued");
});

test("authenticated access intake ignores payload tenantId and scopes to actor tenant", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const token = authToken({
    sub: "access-admin-1",
    tenantId: "town",
    permissions: ["deploy"]
  });

  const created = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({
      tenantId: "other-tenant",
      requester_email: "operator2@town.example.org",
      requested_role: "Records Clerk",
      justification: "Needs controlled access."
    });
  assert.equal(created.status, 201);

  const db = new Database(prrDbPath, { readonly: true });
  const row = db
    .prepare("SELECT tenant_id, requested_by_user_id FROM access_request WHERE id = ?")
    .get(created.body.id) as { tenant_id: string; requested_by_user_id: string | null } | undefined;
  db.close();

  assert.ok(row);
  assert.equal(row?.tenant_id, "town");
  assert.equal(row?.requested_by_user_id, "access-admin-1");
});

test("access request status + close endpoints enforce transitions and write audit entries", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const token = authToken({
    sub: "access-admin-2",
    tenantId: "town",
    permissions: ["deploy"]
  });

  const created = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({
      requester_email: "operator3@town.example.org",
      requested_role: "Administrator",
      justification: "Provision account for governance operations."
    });
  assert.equal(created.status, 201);

  const toReview = await request(app)
    .post(`/api/access/request/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "under_review" });
  assert.equal(toReview.status, 200);
  assert.equal(toReview.body?.status, "under_review");

  const invalid = await request(app)
    .post(`/api/access/request/${created.body.id}/status`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ to_status: "provisioned" });
  assert.equal(invalid.status, 409);
  assert.match(String(invalid.body?.error ?? ""), /invalid status transition/i);

  const closed = await request(app)
    .post(`/api/access/request/${created.body.id}/close`)
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send({ resolution: "Request withdrawn by requester." });
  assert.equal(closed.status, 200);
  assert.equal(closed.body?.status, "closed");
  assert.equal(typeof closed.body?.closed_at, "string");
  assert.equal(closed.body?.resolution, "Request withdrawn by requester.");

  const db = new Database(prrDbPath, { readonly: true });
  const finalRow = db
    .prepare("SELECT status, closed_at, resolution FROM access_request WHERE id = ?")
    .get(created.body.id) as { status: string; closed_at: string | null; resolution: string | null } | undefined;
  const auditRows = db
    .prepare(
      "SELECT action, actor_user_id, from_status, to_status FROM access_request_audit WHERE access_request_id = ? ORDER BY id ASC"
    )
    .all(created.body.id) as Array<{
      action: string;
      actor_user_id: string;
      from_status: string | null;
      to_status: string | null;
    }>;
  db.close();

  assert.ok(finalRow);
  assert.equal(finalRow?.status, "closed");
  assert.equal(typeof finalRow?.closed_at, "string");
  assert.equal(finalRow?.resolution, "Request withdrawn by requester.");

  assert.equal(auditRows.length, 3);
  assert.equal(auditRows[1]?.action, "status_change");
  assert.equal(auditRows[1]?.from_status, "received");
  assert.equal(auditRows[1]?.to_status, "under_review");
  assert.equal(auditRows[2]?.action, "close");
  assert.equal(auditRows[2]?.actor_user_id, "access-admin-2");
  assert.equal(auditRows[2]?.from_status, "under_review");
  assert.equal(auditRows[2]?.to_status, "closed");
});

test("access notification worker delivers queued notifications via webhook", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const created = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_email: "operator4@town.example.org",
      requested_role: "Clerk",
      justification: "Needs access for records operations."
    });
  assert.equal(created.status, 201);

  let callCount = 0;
  await processAccessNotificationQueueOnce({
    prrStore: new PrrStore(prrDbPath),
    webhookUrl: "https://hooks.example.test/access-notification",
    fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
      callCount += 1;
      assert.equal(typeof init?.headers, "object");
      assert.match(String(init?.body ?? ""), /access_request_notification/i);
      return new Response("accepted", { status: 202 });
    }) as typeof fetch,
    batchSize: 10,
    maxRetries: 8
  });

  assert.equal(callCount, 1);
  const db = new Database(prrDbPath, { readonly: true });
  const notificationRow = db
    .prepare(
      "SELECT status, sent_at, retry_count, next_attempt_at, last_error, delivery_response FROM access_request_notification WHERE access_request_id = ? ORDER BY id DESC LIMIT 1"
    )
    .get(created.body.id) as
    | {
        status: string;
        sent_at: string | null;
        retry_count: number;
        next_attempt_at: string | null;
        last_error: string | null;
        delivery_response: string | null;
      }
    | undefined;
  db.close();

  assert.ok(notificationRow);
  assert.equal(notificationRow?.status, "delivered");
  assert.equal(typeof notificationRow?.sent_at, "string");
  assert.equal(notificationRow?.retry_count, 1);
  assert.equal(notificationRow?.next_attempt_at, null);
  assert.equal(notificationRow?.last_error, null);
  assert.match(String(notificationRow?.delivery_response ?? ""), /202/);
});

test("access notification worker marks failed after max retry threshold", async () => {
  const { app, prrDbPath } = createSecuredAppBundle();
  const created = await request(app)
    .post("/api/access/request")
    .set(REQUEST_MARKER_HEADER, "true")
    .send({
      tenantId: "town",
      requester_email: "operator5@town.example.org",
      requested_role: "Records Clerk",
      justification: "Needs scoped records access."
    });
  assert.equal(created.status, 201);

  await processAccessNotificationQueueOnce({
    prrStore: new PrrStore(prrDbPath),
    webhookUrl: "https://hooks.example.test/access-notification",
    fetchImpl: (async () => new Response("failure", { status: 500 })) as typeof fetch,
    batchSize: 10,
    maxRetries: 1
  });

  const db = new Database(prrDbPath, { readonly: true });
  const notificationRow = db
    .prepare(
      "SELECT status, sent_at, retry_count, next_attempt_at, last_error FROM access_request_notification WHERE access_request_id = ? ORDER BY id DESC LIMIT 1"
    )
    .get(created.body.id) as
    | {
        status: string;
        sent_at: string | null;
        retry_count: number;
        next_attempt_at: string | null;
        last_error: string | null;
      }
    | undefined;
  db.close();

  assert.ok(notificationRow);
  assert.equal(notificationRow?.status, "failed");
  assert.equal(notificationRow?.sent_at, null);
  assert.equal(notificationRow?.retry_count, 1);
  assert.equal(notificationRow?.next_attempt_at, null);
  assert.match(String(notificationRow?.last_error ?? ""), /webhook returned 500/i);
});

test("GET /api/sample is not available", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .get("/api/sample")
    .set("Authorization", `Bearer ${authToken()}`);
  assert.equal(response.status, 404);
});

test("POST /api/evaluate returns 401 when unauthenticated", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .send(governedPayload(`srv-unauth-${Date.now()}`));
  assert.equal(response.status, 401);
});

test("POST /api/evaluate enforces request marker header", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/evaluate")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"] })}`)
    .send(governedPayload(`srv-csrf-${Date.now()}`));
  assert.equal(response.status, 403);
});

test("POST /api/evaluate returns 403 when deploy permission is missing", async () => {
  const app = createSecuredApp();
  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken({ permissions: ["notify"] })}`)
    .send(governedPayload(`srv-no-deploy-${Date.now()}`));
  assert.equal(response.status, 403);
});

test("POST /api/evaluate rejects cross-tenant workspace and target scope", async () => {
  const app = createSecuredApp();
  const payload = governedPayload(`srv-tenant-scope-${Date.now()}`);
  payload.workspace.id = "other-tenant";
  payload.action.targets = ["sharepoint:other-tenant:/drive/root:/records/policy", "github:other-tenant/town-ops"];

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send(payload);

  assert.equal(response.status, 403);
  assert.match(String(response.body?.reason ?? ""), /workspace outside authorized tenant scope/i);
});

test("POST /api/evaluate uses verified token identity in audit record", async () => {
  const app = createSecuredApp();
  const token = authToken({
    sub: "verified-operator-id",
    name: "Verified Operator",
    permissions: ["deploy"],
    tenantId: "town",
    tenants: [{ id: "town", name: "Town", sha: "abc123", connections: ["GitHub", "SharePoint"] }]
  });
  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send(governedPayload(`srv-audit-${Date.now()}`));

  assert.equal(response.status, 200);
  assert.equal(response.body?.auditRecord?.operatorId, "verified-operator-id");
});

test("POST /api/evaluate persists decision + audit atomically in SQLite", async () => {
  const app = createSecuredApp();
  const requestId = `srv-atomic-${Date.now()}`;
  const payload = governedPayload(requestId);
  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send(payload);

  assert.equal(response.status, 200);
  const scopedRequestId = `user-1:town:${requestId}`;
  const db = new Database(TMP_DB, { readonly: true });
  const idempotencyRow = db
    .prepare("SELECT request_id, schema_version, result_json FROM idempotency WHERE request_id = ?")
    .get(scopedRequestId) as { request_id: string; schema_version: number; result_json: string | null } | undefined;
  const auditRow = db
    .prepare("SELECT request_id, schema_version, approved, decision_status FROM decision_audit WHERE request_id = ?")
    .get(scopedRequestId) as
    | { request_id: string; schema_version: number; approved: number; decision_status: string }
    | undefined;
  db.close();

  assert.ok(idempotencyRow);
  assert.ok(auditRow);
  assert.equal(idempotencyRow?.schema_version, auditRow?.schema_version);
  assert.equal(auditRow?.approved, 1);
  assert.equal(auditRow?.decision_status, "approved");
});

test("POST /api/evaluate rejects unknown payload fields", async () => {
  const app = createSecuredApp();
  const payload = governedPayload(`srv-invalid-${Date.now()}`) as Record<string, unknown>;
  payload.unexpected = true;

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken({ permissions: ["deploy"] })}`)
    .send(payload);

  assert.equal(response.status, 400);
  assert.match(String(response.body?.error ?? ""), /invalid request payload/i);
});

test("POST /api/evaluate returns 409 on idempotency conflict", async () => {
  const app = createSecuredApp();
  const token = authToken();
  const requestId = `srv-conflict-${Date.now()}`;
  const first = governedPayload(requestId);
  const second = governedPayload(requestId);
  second.action.targets = ["sharepoint:town:/drive/root:/records/other"];

  const firstResponse = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send(first);
  assert.equal(firstResponse.status, 200);

  const secondResponse = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send(second);
  assert.equal(secondResponse.status, 409);
  assert.match(String(secondResponse.body?.warnings?.[0] ?? ""), /idempotency conflict/i);
});

test("POST /api/evaluate concurrent identical requests return same result", async () => {
  const app = createSecuredApp();
  const token = authToken();
  const payload = governedPayload(`srv-concurrent-${Date.now()}`);

  const [first, second] = await Promise.all([
    request(app)
      .post("/api/evaluate")
      .set(REQUEST_MARKER_HEADER, "true")
      .set("Authorization", `Bearer ${token}`)
      .send(payload),
    request(app)
      .post("/api/evaluate")
      .set(REQUEST_MARKER_HEADER, "true")
      .set("Authorization", `Bearer ${token}`)
      .send(payload)
  ]);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.body?.auditRecord?.eventId, second.body?.auditRecord?.eventId);
});

test("POST /api/evaluate blocks canonical localhost URL with 400", async () => {
  const app = createSecuredApp();
  const payload = governedPayload(`srv-localhost-${Date.now()}`, {
    url: "http://127.0.0.1/canonical.json",
    sha: "deadbeef"
  });

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send(payload);

  assert.equal(response.status, 400);
  assert.match(String(response.body?.warnings?.[0] ?? ""), /invalid canonical source/i);
});

test("POST /api/evaluate blocks cloud metadata endpoint canonical URL with 400", async () => {
  const app = createSecuredApp();
  const payload = governedPayload(`srv-metadata-${Date.now()}`, {
    url: "http://169.254.169.254/latest/meta-data/iam/security-credentials",
    sha: "deadbeef"
  });

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send(payload);

  assert.equal(response.status, 400);
  assert.match(String(response.body?.warnings?.[0] ?? ""), /invalid canonical source/i);
});

test("POST /api/evaluate blocks unlisted canonical host with 400", async () => {
  const app = createSecuredApp();
  const payload = governedPayload(`srv-host-${Date.now()}`, {
    url: "https://evil.example.com/canonical.json",
    sha: "deadbeef"
  });

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${authToken()}`)
    .send(payload);

  assert.equal(response.status, 400);
  assert.match(String(response.body?.warnings?.[0] ?? ""), /invalid canonical source/i);
});

test("POST /api/evaluate allows approved canonical GitHub host", async () => {
  let canonicalDocument = JSON.stringify({ planHash: "" });
  const app = createSecuredApp({
    canonicalSourceOptions: {
      resolve4: async () => ["140.82.113.5"],
      resolve6: async () => [],
      fetchImpl: (async () =>
        new Response(canonicalDocument, {
          status: 200,
          headers: { "content-type": "application/json" }
        })) as typeof fetch
    }
  });
  const token = authToken();

  const baselinePayload = governedPayload(`srv-allowed-base-${Date.now()}`);
  const baseline = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send(baselinePayload);
  assert.equal(baseline.status, 200);
  const baselinePlanHash = String(baseline.body?.auditRecord?.planHash ?? "");
  assert.equal(baselinePlanHash.length, 64);

  canonicalDocument = JSON.stringify({ planHash: baselinePlanHash });
  const canonicalSha = sha256(canonicalDocument);
  const payload = governedPayload(`srv-allowed-${Date.now()}`, {
    url: "https://raw.githubusercontent.com/publiclogic/canonical/main.json",
    sha: canonicalSha
  });

  const response = await request(app)
    .post("/api/evaluate")
    .set(REQUEST_MARKER_HEADER, "true")
    .set("Authorization", `Bearer ${token}`)
    .send(payload);

  assert.equal(response.status, 200);
  assert.equal(response.body?.approved, true);
});

test.after(() => {
  if (fs.existsSync(TMP_DB)) {
    fs.unlinkSync(TMP_DB);
  }
  if (fs.existsSync(`${TMP_DB}-shm`)) {
    fs.unlinkSync(`${TMP_DB}-shm`);
  }
  if (fs.existsSync(`${TMP_DB}-wal`)) {
    fs.unlinkSync(`${TMP_DB}-wal`);
  }
  for (const rateDbPath of RATE_LIMIT_DB_PATHS) {
    if (fs.existsSync(rateDbPath)) {
      fs.unlinkSync(rateDbPath);
    }
    if (fs.existsSync(`${rateDbPath}-shm`)) {
      fs.unlinkSync(`${rateDbPath}-shm`);
    }
    if (fs.existsSync(`${rateDbPath}-wal`)) {
      fs.unlinkSync(`${rateDbPath}-wal`);
    }
  }
  for (const prrDbPath of PRR_DB_PATHS) {
    if (fs.existsSync(prrDbPath)) {
      fs.unlinkSync(prrDbPath);
    }
    if (fs.existsSync(`${prrDbPath}-shm`)) {
      fs.unlinkSync(`${prrDbPath}-shm`);
    }
    if (fs.existsSync(`${prrDbPath}-wal`)) {
      fs.unlinkSync(`${prrDbPath}-wal`);
    }
  }
  for (const connectorDbPath of CONNECTOR_DB_PATHS) {
    if (fs.existsSync(connectorDbPath)) {
      fs.unlinkSync(connectorDbPath);
    }
    if (fs.existsSync(`${connectorDbPath}-shm`)) {
      fs.unlinkSync(`${connectorDbPath}-shm`);
    }
    if (fs.existsSync(`${connectorDbPath}-wal`)) {
      fs.unlinkSync(`${connectorDbPath}-wal`);
    }
  }
});
