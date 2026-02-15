// ── Webhook Dispatch Integration Tests ──────────────────────────────────────
//
// Tests the full governed webhook lifecycle:
//   1. POST /api/pj/actions/webhook (governed) → 202 + approvalId
//   2. POST /api/approvals/:id/decide { status: "approved" }
//   3. POST /api/approvals/:id/dispatch → WebhookDispatcher fires
//
// Also tests: launch mode, dry-run mode, failure paths, metrics.
//
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import express from "express";
import request from "supertest";
import { signJwt, cookieParserMiddleware, csrfProtection } from "@publiclogic/core";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import { DispatcherRegistry } from "../src/engine/dispatch.js";
import { WebhookDispatcher } from "../src/engine/dispatchers/webhook.js";
import { createApprovalRoutes } from "../src/api/routes/approvals.js";
import { createWebhookActionRoutes } from "../src/api/routes/webhookAction.js";
import { approvalMetrics, METRIC } from "../src/engine/approvalMetrics.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

let store: ApprovalStore;
let registry: DispatcherRegistry;
let tmpDir: string;

const ADMIN = { sub: "admin-1", name: "Admin", role: "admin", permissions: ["deploy"], tenants: ["t1"], tenantId: "t1" };
const VIEWER = { sub: "viewer-1", name: "Viewer", role: "viewer", permissions: [], tenants: ["t1"], tenantId: "t1" };

/** Read a counter metric value from snapshot. */
function counter(name: string): number {
  const snap = approvalMetrics.snapshot();
  return snap.find(m => m.name === name && m.type === "counter")?.value ?? 0;
}

async function tokenFor(user: Record<string, unknown>) {
  return signJwt(user, { expiresIn: "1h" });
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

  // Mount routes
  app.use("/api", createWebhookActionRoutes({ approvalStore: store, dispatcherRegistry: registry }));
  app.use("/api", createApprovalRoutes({ approvalStore: store, dispatcherRegistry: registry, nodeEnv: "test" }));

  return app;
}

// ── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "webhook-test-"));
  store = new ApprovalStore(path.join(tmpDir, "approvals.db"));
  registry = new DispatcherRegistry();
  registry.register(new WebhookDispatcher());
  approvalMetrics.reset();
});

afterEach(() => {
  store.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Governed Webhook Action", () => {

  describe("Happy path: governed → approve → dispatch", () => {
    it("creates approval on governed mode, dispatches on approve + dispatch", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

      // Intercept fetch for the webhook call
      const originalFetch = globalThis.fetch;
      const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
      globalThis.fetch = (async (input: any, init?: any) => {
        fetchCalls.push({ url: String(input), init: init ?? {} });
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }) as typeof fetch;

      try {
        // Step 1: Create governed webhook action → 202
        const createRes = await request(app)
          .post("/api/pj/actions/webhook")
          .set(h)
          .send({
            mode: "governed",
            action: {
              type: "webhook",
              url: "https://httpbin.org/post",
              body: { hello: "world" },
            },
          });
        expect(createRes.status).toBe(202);
        expect(createRes.body.approvalRequired).toBe(true);
        const approvalId = createRes.body.approvalId;
        expect(approvalId).toBeTruthy();

        // Verify approvals_created_total incremented
        expect(counter(METRIC.APPROVALS_CREATED)).toBe(1);

        // Step 2: Approve
        const decideRes = await request(app)
          .post(`/api/approvals/${approvalId}/decide`)
          .set(h)
          .send({ status: "approved", note: "Looks good" });
        expect(decideRes.status).toBe(200);
        expect(decideRes.body.data.approval_status).toBe("approved");

        // Verify approvals_approved_total incremented
        expect(counter(METRIC.APPROVALS_APPROVED)).toBe(1);

        // Step 3: Dispatch
        const dispatchRes = await request(app)
          .post(`/api/approvals/${approvalId}/dispatch`)
          .set(h)
          .send({});
        expect(dispatchRes.status).toBe(200);
        expect(dispatchRes.body.success).toBe(true);
        expect(dispatchRes.body.data.dispatchResult.success).toBe(true);
        expect(dispatchRes.body.data.approvalStatus).toBe("dispatched");

        // Verify dispatch_success_total incremented
        expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(1);

        // Verify the webhook was actually called
        expect(fetchCalls.length).toBe(1);
        expect(fetchCalls[0].url).toBe("https://httpbin.org/post");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Failure path: webhook returns 500", () => {
    it("marks dispatch as failed when webhook returns non-2xx", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

      // Mock fetch returning 500
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response("Internal Server Error", { status: 500 });
      }) as typeof fetch;

      try {
        // Create → approve → dispatch
        const createRes = await request(app)
          .post("/api/pj/actions/webhook")
          .set(h)
          .send({ mode: "governed", action: { type: "webhook", url: "https://failing.example.com/hook" } });
        expect(createRes.status).toBe(202);
        const approvalId = createRes.body.approvalId;

        await request(app)
          .post(`/api/approvals/${approvalId}/decide`)
          .set(h)
          .send({ status: "approved" });

        const dispatchRes = await request(app)
          .post(`/api/approvals/${approvalId}/dispatch`)
          .set(h)
          .send({});
        expect(dispatchRes.status).toBe(200);
        expect(dispatchRes.body.success).toBe(false);
        expect(dispatchRes.body.data.dispatchResult.success).toBe(false);
        expect(dispatchRes.body.data.approvalStatus).toBe("dispatch_failed");

        // Verify dispatch_failure_total incremented
        expect(counter(METRIC.DISPATCH_FAILURE)).toBe(1);
        expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Governance gate modes", () => {
    it("launch mode bypasses approval and dispatches immediately", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

      const originalFetch = globalThis.fetch;
      const fetchCalls: string[] = [];
      globalThis.fetch = (async (input: any) => {
        fetchCalls.push(String(input));
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      try {
        const res = await request(app)
          .post("/api/pj/actions/webhook")
          .set(h)
          .send({
            mode: "launch",
            action: { type: "webhook", url: "https://launch.example.com/hook", body: { fast: true } },
          });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.mode).toBe("launch");
        expect(res.body.data.dispatchResult.success).toBe(true);

        // Should not have created an approval
        expect(counter(METRIC.APPROVALS_CREATED)).toBe(0);
        // But should have recorded dispatch success
        expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(1);
        // Webhook was called
        expect(fetchCalls).toContain("https://launch.example.com/hook");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("dry-run mode returns plan without creating approval or dispatching", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

      const originalFetch = globalThis.fetch;
      let fetchCalled = false;
      globalThis.fetch = (async () => { fetchCalled = true; return new Response("", { status: 200 }); }) as typeof fetch;

      try {
        const res = await request(app)
          .post("/api/pj/actions/webhook")
          .set(h)
          .send({
            mode: "dry-run",
            action: { type: "webhook", url: "https://dryrun.example.com/hook", method: "PUT" },
          });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.mode).toBe("dry-run");
        expect(res.body.data.plan).toHaveLength(1);
        expect(res.body.data.plan[0].connector).toBe("webhook");
        expect(res.body.data.plan[0].plan.url).toBe("https://dryrun.example.com/hook");
        expect(res.body.data.plan[0].plan.method).toBe("PUT");

        // No approval created, no dispatch
        expect(counter(METRIC.APPROVALS_CREATED)).toBe(0);
        expect(counter(METRIC.DISPATCH_SUCCESS)).toBe(0);
        expect(fetchCalled).toBe(false);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("Authorization", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const app = buildApp();
      const res = await request(app)
        .post("/api/pj/actions/webhook")
        .set({ "X-PuddleJumper-Request": "true" })
        .send({ mode: "governed", action: { type: "webhook", url: "https://example.com" } });
      expect(res.status).toBe(401);
    });

    it("rejects non-admin users with 403", async () => {
      const app = buildApp();
      const viewerToken = await tokenFor(VIEWER);
      const res = await request(app)
        .post("/api/pj/actions/webhook")
        .set({ Authorization: `Bearer ${viewerToken}`, "X-PuddleJumper-Request": "true" })
        .send({ mode: "governed", action: { type: "webhook", url: "https://example.com" } });
      expect(res.status).toBe(403);
    });
  });

  describe("Validation", () => {
    it("rejects invalid URL", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
      const res = await request(app)
        .post("/api/pj/actions/webhook")
        .set(h)
        .send({ mode: "governed", action: { type: "webhook", url: "not-a-url" } });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid");
    });

    it("rejects wrong action type", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
      const res = await request(app)
        .post("/api/pj/actions/webhook")
        .set(h)
        .send({ mode: "governed", action: { type: "email", url: "https://example.com" } });
      expect(res.status).toBe(400);
    });

    it("rejects missing action", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };
      const res = await request(app)
        .post("/api/pj/actions/webhook")
        .set(h)
        .send({ mode: "governed" });
      expect(res.status).toBe(400);
    });
  });

  describe("WebhookDispatcher unit", () => {
    it("returns failed when plan has no url", async () => {
      const dispatcher = new WebhookDispatcher();
      const result = await dispatcher.dispatch(
        { stepId: "s1", description: "test", requiresApproval: false, connector: "webhook", status: "ready", plan: {} },
        { approvalId: "a1", requestId: "r1", operatorId: "op1", dryRun: false },
      );
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Missing url");
    });

    it("returns dry-run result without calling fetch", async () => {
      const dispatcher = new WebhookDispatcher();
      const result = await dispatcher.dispatch(
        { stepId: "s1", description: "test", requiresApproval: false, connector: "webhook", status: "ready", plan: { url: "https://example.com" } },
        { approvalId: "a1", requestId: "r1", operatorId: "op1", dryRun: true },
      );
      expect(result.status).toBe("dispatched");
      expect(result.result?.dryRun).toBe(true);
    });

    it("healthCheck returns healthy", async () => {
      const dispatcher = new WebhookDispatcher();
      const health = await dispatcher.healthCheck();
      expect(health.healthy).toBe(true);
    });
  });
});
