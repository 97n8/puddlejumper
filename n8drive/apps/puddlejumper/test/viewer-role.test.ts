// ── Day 1: Public Viewer Role Tests ─────────────────────────────────────────
//
// Tests for:
//   1a. User store: upsertUser creates viewer by default, preserves admin
//   1b. GET /api/me endpoint returns user profile + role
//   1c. Viewer can GET approvals, chain progress, stats, templates (200)
//   1d. Viewer cannot POST/PUT/DELETE mutations (403)
//   1e. Admin retains full access (no regression)
//   1f. Admin HTML serves to unauthenticated users (200)
//   1g. onUserAuthenticated hook resolves role into JWT
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection, getAuthContext } from "@publiclogic/core";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import { ChainStore } from "../src/engine/chainStore.js";
import { approvalMetrics, METRIC } from "../src/engine/approvalMetrics.js";
import { createAdminRoutes } from "../src/api/routes/admin.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";
import { createChainTemplateRoutes } from "../src/api/routes/chainTemplates.js";
import { upsertUser, findUser, setUserRole, resetUserDb } from "../src/api/userStore.js";
import {
  DispatcherRegistry,
  type ConnectorDispatcher,
  type PlanStepInput,
  type DispatchContext,
} from "../src/engine/dispatch.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let approvalStore: ApprovalStore;
let chainStore: ChainStore;
let registry: DispatcherRegistry;
let tmpDir: string;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
}

function createMockDispatcher(): ConnectorDispatcher {
  return {
    connectorName: "github" as any,
    async dispatch(step: PlanStepInput, context: DispatchContext) {
      return {
        stepId: step.stepId,
        connector: step.connector,
        status: "dispatched" as const,
        result: { mock: true },
        completedAt: new Date().toISOString(),
      };
    },
    async healthCheck() { return { healthy: true }; },
  };
}

function buildApp() {
  const app = express();
  app.use(cookieParserMiddleware());
  app.use(express.json());

  // JWT auth middleware
  app.use(async (req: any, _res: any, next: any) => {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      try {
        const { verifyJwt } = await import("@publiclogic/core");
        req.auth = await verifyJwt(h.slice(7));
      } catch { /* unauthenticated */ }
    }
    next();
  });

  app.use(csrfProtection());

  // GET /api/me
  app.get("/api/me", (req: any, res: any) => {
    const auth = getAuthContext(req);
    if (!auth?.sub) { res.status(401).json({ error: "Unauthorized" }); return; }
    res.json({
      sub: auth.sub,
      email: auth.email ?? null,
      name: auth.name ?? null,
      role: auth.role ?? "viewer",
      provider: auth.provider ?? null,
    });
  });

  app.use("/api", createAdminRoutes({ approvalStore, chainStore }));
  app.use("/api", createApprovalRoutes({
    approvalStore, dispatcherRegistry: registry, nodeEnv: "test", chainStore,
  }));
  app.use("/api", createChainTemplateRoutes({ chainStore }));

  return app;
}

function createApproval(overrides: Record<string, unknown> = {}) {
  return approvalStore.create({
    requestId: overrides.requestId as string ?? `req-${crypto.randomUUID()}`,
    operatorId: overrides.operatorId as string ?? "admin-1",
    workspaceId: "ws-test",
    municipalityId: "muni-test",
    actionIntent: overrides.actionIntent as string ?? "deploy_policy",
    actionMode: "governed",
    planHash: "hash-" + crypto.randomUUID(),
    planSteps: [
      { stepId: "s1", description: "Test step", requiresApproval: false, connector: "github", status: "ready", plan: {} },
    ],
    auditRecord: { eventId: "evt-test", timestamp: new Date().toISOString() },
    decisionResult: { status: "approved", approved: true },
  });
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewer-role-test-"));
  approvalStore = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  chainStore = new ChainStore(approvalStore.db);
  registry = new DispatcherRegistry();
  registry.register(createMockDispatcher());
  approvalMetrics.reset();
  resetUserDb();
});

afterEach(() => {
  approvalStore.close();
  resetUserDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1a. User store — auto-assign viewer role
// ═════════════════════════════════════════════════════════════════════════════
describe("User store", () => {
  it("creates new user with viewer role by default", () => {
    const user = upsertUser(tmpDir, { sub: "gh-123", email: "a@b.com", name: "Alice", provider: "github" });
    expect(user.role).toBe("viewer");
    expect(user.sub).toBe("gh-123");
    expect(user.email).toBe("a@b.com");
  });

  it("preserves existing role on re-login (no downgrade)", () => {
    // Create user as viewer
    upsertUser(tmpDir, { sub: "gh-456", email: "b@b.com", name: "Bob", provider: "github" });
    // Manually upgrade to admin
    setUserRole(tmpDir, "gh-456", "github", "admin");
    // Re-login
    const updated = upsertUser(tmpDir, { sub: "gh-456", email: "bob-new@b.com", name: "Bobby", provider: "github" });
    expect(updated.role).toBe("admin"); // not downgraded
    expect(updated.email).toBe("bob-new@b.com"); // profile updated
    expect(updated.name).toBe("Bobby");
  });

  it("isolates users by provider", () => {
    const ghUser = upsertUser(tmpDir, { sub: "123", provider: "github" });
    const msUser = upsertUser(tmpDir, { sub: "123", provider: "microsoft" });
    expect(ghUser.role).toBe("viewer");
    expect(msUser.role).toBe("viewer");
    // Different records
    const found = findUser(tmpDir, "123", "github");
    expect(found).not.toBeNull();
    expect(found!.provider).toBe("github");
  });

  it("findUser returns null for unknown user", () => {
    const found = findUser(tmpDir, "nonexistent", "github");
    expect(found).toBeNull();
  });

  it("setUserRole updates role", () => {
    upsertUser(tmpDir, { sub: "gh-789", provider: "github" });
    const ok = setUserRole(tmpDir, "gh-789", "github", "admin");
    expect(ok).toBe(true);
    const found = findUser(tmpDir, "gh-789", "github");
    expect(found!.role).toBe("admin");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1b. GET /api/me
// ═════════════════════════════════════════════════════════════════════════════
describe("GET /api/me", () => {
  it("returns user profile and role for authenticated user", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const res = await request(app)
      .get("/api/me")
      .set({ Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" });

    expect(res.status).toBe(200);
    expect(res.body.sub).toBe("viewer-1");
    expect(res.body.role).toBe("viewer");
    expect(res.body.name).toBe("Viewer");
  });

  it("returns 401 when unauthenticated", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/me")
      .set({ "X-PuddleJumper-Request": "true" });

    expect(res.status).toBe(401);
  });

  it("returns admin role for admin user", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const res = await request(app)
      .get("/api/me")
      .set({ Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe("admin");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1c. Viewer can GET read-only endpoints (200)
// ═════════════════════════════════════════════════════════════════════════════
describe("Viewer read-only access", () => {
  it("viewer can GET /api/approvals", async () => {
    const app = buildApp();
    createApproval();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/approvals").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.approvals.length).toBeGreaterThanOrEqual(1);
  });

  it("viewer can GET /api/approvals/:id", async () => {
    const app = buildApp();
    const a = createApproval();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get(`/api/approvals/${a.id}`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("viewer can GET /api/approvals/:id/chain", async () => {
    const app = buildApp();
    const a = createApproval();
    chainStore.createChainForApproval(a.id);
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get(`/api/approvals/${a.id}/chain`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it("viewer can GET /api/chain-templates", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/chain-templates").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("viewer can GET /api/chain-templates/:id", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/chain-templates/default").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("viewer can GET /api/admin/stats", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/admin/stats").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pending).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1d. Viewer cannot POST/PUT/DELETE mutations (403)
// ═════════════════════════════════════════════════════════════════════════════
describe("Viewer mutation denial", () => {
  it("viewer cannot POST /api/approvals/:id/decide (403)", async () => {
    const app = buildApp();
    const a = createApproval();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${a.id}/decide`)
      .set(h)
      .send({ status: "approved" });
    expect(res.status).toBe(403);
  });

  it("viewer cannot POST /api/approvals/:id/dispatch (403)", async () => {
    const app = buildApp();
    const a = createApproval();
    // Approve it first as admin
    approvalStore.decide({ approvalId: a.id, approverId: "admin-1", status: "approved" });

    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${a.id}/dispatch`)
      .set(h)
      .send({});
    expect(res.status).toBe(403);
  });

  it("viewer cannot POST /api/chain-templates (403)", async () => {
    const app = buildApp();
    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({ name: "Test", steps: [{ order: 0, requiredRole: "admin", label: "Step 1" }] });
    expect(res.status).toBe(403);
  });

  it("viewer cannot PUT /api/chain-templates/:id (403)", async () => {
    const app = buildApp();
    // Create a template as admin first
    const adminToken = await tokenFor(ADMIN);
    const adminH = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
    await request(app)
      .post("/api/chain-templates")
      .set(adminH)
      .send({ id: "test-tmpl", name: "Test", steps: [{ order: 0, requiredRole: "admin", label: "S1" }] });

    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .put("/api/chain-templates/test-tmpl")
      .set(h)
      .send({ name: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("viewer cannot DELETE /api/chain-templates/:id (403)", async () => {
    const app = buildApp();
    const adminToken = await tokenFor(ADMIN);
    const adminH = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
    await request(app)
      .post("/api/chain-templates")
      .set(adminH)
      .send({ id: "del-tmpl", name: "Del", steps: [{ order: 0, requiredRole: "admin", label: "S1" }] });

    const token = await tokenFor(VIEWER);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .delete("/api/chain-templates/del-tmpl")
      .set(h);
    expect(res.status).toBe(403);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1e. Admin retains full access (no regression)
// ═════════════════════════════════════════════════════════════════════════════
describe("Admin full access (regression check)", () => {
  it("admin can GET /api/admin/stats", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/admin/stats").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("admin can GET /api/chain-templates", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app).get("/api/chain-templates").set(h);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("admin can POST /api/approvals/:id/decide", async () => {
    const app = buildApp();
    const a = createApproval();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post(`/api/approvals/${a.id}/decide`)
      .set(h)
      .send({ status: "approved" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("admin can POST /api/chain-templates", async () => {
    const app = buildApp();
    const token = await tokenFor(ADMIN);
    const h = { Authorization: `Bearer ${token}`, "X-PuddleJumper-Request": "true" };

    const res = await request(app)
      .post("/api/chain-templates")
      .set(h)
      .send({ name: "Admin Template", steps: [{ order: 0, requiredRole: "admin", label: "A1" }] });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("existing admin not downgraded on re-login", () => {
    // Create user and promote to admin
    upsertUser(tmpDir, { sub: "admin-sub", provider: "github", name: "Admin" });
    setUserRole(tmpDir, "admin-sub", "github", "admin");

    // Simulate re-login
    const user = upsertUser(tmpDir, { sub: "admin-sub", provider: "github", name: "Admin Updated" });
    expect(user.role).toBe("admin");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1f. Admin HTML serves to unauthenticated users
// ═════════════════════════════════════════════════════════════════════════════
describe("Admin UI HTML serving", () => {
  it("GET /pj/admin serves HTML to unauthenticated users", async () => {
    const app = express();
    // Serve admin.html the same way server.ts does
    const publicDir = path.resolve(__dirname, "../public");
    const adminFile = path.join(publicDir, "admin.html");
    app.get("/pj/admin", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.type("html").sendFile(adminFile);
    });

    const res = await request(app).get("/pj/admin");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("html");
    expect(res.text).toContain("PuddleJumper");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 1g. onUserAuthenticated hook
// ═════════════════════════════════════════════════════════════════════════════
describe("onUserAuthenticated hook", () => {
  it("hook receives user info and returns enriched UserInfo with role", () => {
    // Simulate what the hook does in server.ts
    const hookFn = (userInfo: { sub: string; email?: string; name?: string; provider: string }) => {
      const row = upsertUser(tmpDir, {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        provider: userInfo.provider,
      });
      return { ...userInfo, role: row.role };
    };

    const result = hookFn({ sub: "new-user", email: "new@test.com", name: "New", provider: "github" });
    expect(result.role).toBe("viewer");
    expect(result.sub).toBe("new-user");

    // Second call — same user, should keep viewer
    const result2 = hookFn({ sub: "new-user", email: "new@test.com", name: "New", provider: "github" });
    expect(result2.role).toBe("viewer");
  });

  it("hook preserves admin role on re-auth", () => {
    const hookFn = (userInfo: { sub: string; email?: string; name?: string; provider: string }) => {
      const row = upsertUser(tmpDir, {
        sub: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        provider: userInfo.provider,
      });
      return { ...userInfo, role: row.role };
    };

    // First login → viewer
    hookFn({ sub: "admin-hook", provider: "github" });
    setUserRole(tmpDir, "admin-hook", "github", "admin");

    // Re-login → still admin
    const result = hookFn({ sub: "admin-hook", provider: "github" });
    expect(result.role).toBe("admin");
  });
});
