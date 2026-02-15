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
import { DispatcherRegistry, dispatchWithRetry, isTransientFailure } from "../src/engine/dispatch.js";
import type { RetryPolicy, DispatchStepResult, PlanStepInput, DispatchContext } from "../src/engine/dispatch.js";
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

  describe("Retry with exponential backoff", () => {
    const STEP: PlanStepInput = {
      stepId: "rs-1",
      description: "retry test step",
      requiresApproval: false,
      connector: "webhook",
      status: "ready",
      plan: { url: "https://retry-test.example.com/hook" },
    };
    const CTX: DispatchContext = {
      approvalId: "a-retry",
      requestId: "r-retry",
      operatorId: "op-retry",
      dryRun: false,
    };

    it("succeeds after transient 503 failures then 200", async () => {
      const dispatcher = new WebhookDispatcher();
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        if (callCount <= 2) return new Response("Service Unavailable", { status: 503 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      const retryAttempts: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 10, // fast for tests
        onRetry: (attempt) => { retryAttempts.push(attempt); },
      };

      try {
        const { result, retries } = await dispatchWithRetry(dispatcher, STEP, CTX, policy);
        expect(result.status).toBe("dispatched");
        expect(retries).toBe(2);
        expect(retryAttempts).toEqual([1, 2]);
        expect(callCount).toBe(3);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("fails after exhausting all retry attempts on 503", async () => {
      const dispatcher = new WebhookDispatcher();
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        return new Response("Service Unavailable", { status: 503 });
      }) as typeof fetch;

      const retryAttempts: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 10,
        onRetry: (attempt) => { retryAttempts.push(attempt); },
      };

      try {
        const { result, retries } = await dispatchWithRetry(dispatcher, STEP, CTX, policy);
        expect(result.status).toBe("failed");
        expect(result.error).toContain("503");
        expect(retries).toBe(2); // maxAttempts-1 retries
        expect(retryAttempts).toEqual([1, 2]);
        expect(callCount).toBe(3);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("does NOT retry on permanent 400 failure", async () => {
      const dispatcher = new WebhookDispatcher();
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        return new Response("Bad Request", { status: 400 });
      }) as typeof fetch;

      const retryAttempts: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 10,
        onRetry: (attempt) => { retryAttempts.push(attempt); },
      };

      try {
        const { result, retries } = await dispatchWithRetry(dispatcher, STEP, CTX, policy);
        expect(result.status).toBe("failed");
        expect(retries).toBe(0);
        expect(retryAttempts).toEqual([]);
        expect(callCount).toBe(1); // no retries for 4xx
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("does NOT retry on validation failure (missing url)", async () => {
      const dispatcher = new WebhookDispatcher();
      const noUrlStep: PlanStepInput = { ...STEP, plan: {} };

      const retryAttempts: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 10,
        onRetry: (attempt) => { retryAttempts.push(attempt); },
      };

      const { result, retries } = await dispatchWithRetry(dispatcher, noUrlStep, CTX, policy);
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Missing url");
      expect(retries).toBe(0);
      expect(retryAttempts).toEqual([]);
    });

    it("retries network errors (fetch throws)", async () => {
      const dispatcher = new WebhookDispatcher();
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = (async () => {
        callCount++;
        if (callCount === 1) throw new TypeError("fetch failed");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch;

      const retryAttempts: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 10,
        onRetry: (attempt) => { retryAttempts.push(attempt); },
      };

      try {
        const { result, retries } = await dispatchWithRetry(dispatcher, STEP, CTX, policy);
        // The fetch error is caught inside the WebhookDispatcher and returned
        // as a failed step. dispatchWithRetry then wraps throws as well.
        // Either way, the error should be retryable and succeed on attempt 2.
        expect(result.status).toBe("dispatched");
        expect(retries).toBe(1);
        expect(callCount).toBe(2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("observes exponential backoff timing", async () => {
      const dispatcher = new WebhookDispatcher();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response("Server Error", { status: 500 });
      }) as typeof fetch;

      const timestamps: number[] = [];
      const policy: RetryPolicy = {
        maxAttempts: 3,
        baseDelayMs: 50,
        onRetry: () => { timestamps.push(Date.now()); },
      };

      try {
        const start = Date.now();
        await dispatchWithRetry(dispatcher, STEP, CTX, policy);
        const elapsed = Date.now() - start;
        // 50ms (attempt1→2) + 100ms (attempt2→3) = 150ms minimum
        expect(elapsed).toBeGreaterThanOrEqual(130); // allow small timing variance
        expect(timestamps.length).toBe(2);
        // Second delay should be ~2x the first
        const gap1 = timestamps[0] - start;
        const gap2 = timestamps[1] - timestamps[0];
        expect(gap2).toBeGreaterThan(gap1 * 1.5); // exponential, not linear
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("isTransientFailure classification", () => {
    const base: DispatchStepResult = {
      stepId: "s1",
      connector: "webhook",
      status: "failed",
      completedAt: new Date().toISOString(),
    };

    it("classifies 500 as transient", () => {
      expect(isTransientFailure({ ...base, error: "Webhook failed: 500" })).toBe(true);
    });

    it("classifies 502 as transient", () => {
      expect(isTransientFailure({ ...base, error: "Webhook failed: 502" })).toBe(true);
    });

    it("classifies 503 as transient", () => {
      expect(isTransientFailure({ ...base, error: "Webhook failed: 503" })).toBe(true);
    });

    it("classifies 400 as permanent", () => {
      expect(isTransientFailure({ ...base, error: "Webhook failed: 400" })).toBe(false);
    });

    it("classifies 404 as permanent", () => {
      expect(isTransientFailure({ ...base, error: "Webhook failed: 404" })).toBe(false);
    });

    it("classifies ECONNREFUSED as transient", () => {
      expect(isTransientFailure({ ...base, error: "ECONNREFUSED" })).toBe(true);
    });

    it("classifies fetch failed as transient", () => {
      expect(isTransientFailure({ ...base, error: "fetch failed" })).toBe(true);
    });

    it("classifies Missing url as permanent", () => {
      expect(isTransientFailure({ ...base, error: "Missing url in plan" })).toBe(false);
    });

    it("returns false for non-failed status", () => {
      expect(isTransientFailure({ ...base, status: "dispatched", error: "Webhook failed: 500" })).toBe(false);
    });
  });

  describe("Integration: retry metrics through governed dispatch", () => {
    it("increments dispatch_retry_total on transient failures", async () => {
      const app = buildApp();
      const adminToken = await tokenFor(ADMIN);
      const h = { Authorization: `Bearer ${adminToken}`, "X-PuddleJumper-Request": "true" };

      // Mock fetch: 500 three times (all retries exhausted)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => {
        return new Response("Internal Server Error", { status: 500 });
      }) as typeof fetch;

      try {
        const createRes = await request(app)
          .post("/api/pj/actions/webhook")
          .set(h)
          .send({ mode: "governed", action: { type: "webhook", url: "https://retry-metric.example.com/hook" } });
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

        // Dispatch retried 2 times (maxAttempts=3 → 2 retries)
        expect(counter(METRIC.DISPATCH_RETRY)).toBe(2);
        expect(counter(METRIC.DISPATCH_FAILURE)).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
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
