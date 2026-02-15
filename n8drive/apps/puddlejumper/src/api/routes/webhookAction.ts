// ── Governed Webhook Action Route ───────────────────────────────────────────
//
// Provides a direct path for webhook-type actions through the governance gate.
//
// Modes:
//   governed  → creates an approval record with a webhook plan step → 202
//   launch    → dispatches the webhook immediately (no approval) → 200
//   dry-run   → validates and returns the plan without dispatching → 200
//
import crypto from "node:crypto";
import express from "express";
import { z } from "zod";
import {
  getAuthContext,
  requireAuthenticated,
} from "@publiclogic/core";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { DispatcherRegistry, PlanStepInput, RetryPolicy } from "../../engine/dispatch.js";
import { dispatchPlan } from "../../engine/dispatch.js";
import { getCorrelationId } from "../serverMiddleware.js";
import { approvalMetrics, emitApprovalEvent, METRIC } from "../../engine/approvalMetrics.js";

// ── Request validation ──────────────────────────────────────────────────────

const webhookActionSchema = z.object({
  mode: z.enum(["governed", "launch", "dry-run"]).default("governed"),
  action: z.object({
    type: z.literal("webhook"),
    url: z.string().url().max(2048),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
  }).strict(),
}).strict();

// ── Route options ───────────────────────────────────────────────────────────

export type WebhookActionRouteOptions = {
  approvalStore: ApprovalStore;
  dispatcherRegistry: DispatcherRegistry;
};

// ── Router ──────────────────────────────────────────────────────────────────

export function createWebhookActionRoutes(opts: WebhookActionRouteOptions): express.Router {
  const router = express.Router();
  const { approvalStore, dispatcherRegistry } = opts;

  // POST /api/pj/actions/webhook
  router.post("/pj/actions/webhook", requireAuthenticated(), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }

    // Only admins can create governed actions
    if (auth.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Only admins can execute webhook actions" });
      return;
    }

    const parsed = webhookActionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        correlationId,
        error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }

    const { mode, action } = parsed.data;
    const requestId = `webhook-${correlationId}`;

    // Build the webhook plan step
    const planStep: PlanStepInput = {
      stepId: `ws-${crypto.randomUUID().slice(0, 8)}`,
      description: `Webhook ${action.method ?? "POST"} → ${action.url}`,
      requiresApproval: mode === "governed",
      connector: "webhook",
      status: "ready",
      plan: {
        url: action.url,
        method: action.method ?? "POST",
        headers: action.headers ?? {},
        body: action.body,
      },
    };

    // ── Dry-run: validate and return the plan ───────────────────────────
    if (mode === "dry-run") {
      res.status(200).json({
        success: true,
        correlationId,
        mode: "dry-run",
        data: { plan: [planStep] },
      });
      return;
    }

    // ── Governed: create approval record → 202 ─────────────────────────
    if (mode === "governed") {
      const planHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(planStep.plan))
        .digest("hex")
        .slice(0, 16);

      const approval = approvalStore.create({
        requestId,
        operatorId: auth.userId ?? auth.sub ?? "unknown",
        workspaceId: "default",
        municipalityId: "default",
        actionIntent: "webhook_dispatch",
        actionMode: "governed",
        planHash,
        planSteps: [planStep],
        auditRecord: {
          eventId: `evt-${requestId}`,
          timestamp: new Date().toISOString(),
          action: "webhook_dispatch",
          url: action.url,
        },
        decisionResult: { status: "approved", approved: true },
      });

      approvalMetrics.increment(METRIC.APPROVALS_CREATED);
      approvalMetrics.incrementGauge(METRIC.PENDING_GAUGE);
      emitApprovalEvent("created", {
        approvalId: approval.id,
        operatorId: auth.userId ?? auth.sub,
        intent: "webhook_dispatch",
        correlationId,
      });

      res.status(202).json({
        success: true,
        correlationId,
        approvalRequired: true,
        approvalId: approval.id,
        approvalStatus: "pending",
        data: { plan: [planStep] },
        message: "Webhook action requires approval before dispatch.",
      });
      return;
    }

    // ── Launch: dispatch immediately ────────────────────────────────────
    const retryPolicy: RetryPolicy = {
      maxAttempts: 3,
      baseDelayMs: 1000,
      onRetry: (attempt, error, stepId) => {
        approvalMetrics.increment(METRIC.DISPATCH_RETRY);
        emitApprovalEvent("dispatch_retry", { stepId, attempt, error, correlationId });
      },
    };

    const result = await dispatchPlan(
      [planStep],
      {
        approvalId: `direct-${crypto.randomUUID().slice(0, 8)}`,
        requestId,
        operatorId: auth.userId ?? auth.sub ?? "unknown",
        dryRun: false,
      },
      dispatcherRegistry,
      retryPolicy,
    );

    if (result.success) {
      approvalMetrics.increment(METRIC.DISPATCH_SUCCESS);
    } else {
      approvalMetrics.increment(METRIC.DISPATCH_FAILURE);
    }

    res.status(result.success ? 200 : 502).json({
      success: result.success,
      correlationId,
      mode: "launch",
      data: { dispatchResult: result },
    });
  });

  return router;
}
