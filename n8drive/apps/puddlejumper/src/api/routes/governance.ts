// ── PJ execute, identity-token, prompt, evaluate routes ─────────────────────
import crypto from "node:crypto";
import express from "express";
import {
  getAuthContext,
  requireAuthenticated,
  requirePermission,
  requireRole,
  signJwt,
} from "@publiclogic/core";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "../types.js";
import { evaluateRequestSchema, pjExecuteRequestSchema } from "../schemas.js";
import { createDefaultEngine } from "../../engine/governanceEngine.js";
import type { ApprovalStore } from "../../engine/approvalStore.js";
import type { ChainStore } from "../../engine/chainStore.js";
import type { PolicyProvider } from "../../engine/policyProvider.js";
import { getSystemPromptText } from "../../prompt/systemPrompt.js";
import type { CanonicalSourceOptions } from "../canonicalSource.js";
import {
  buildCapabilityManifest,
  PJ_ACTION_DEFINITIONS,
  isPjActionAllowed,
  buildPjEvaluatePayload,
  resolveDecisionStatusCode,
  buildPjExecuteData,
  assertTenantScope,
  scopedRequestId,
} from "../capabilities.js";
import {
  extractMsGraphToken,
  fetchMsGraphProfile,
  buildMsGraphAuthContext,
} from "../msGraph.js";
import {
  getCorrelationId,
  logServerError,
  logServerInfo,
  summarizePrompt,
} from "../serverMiddleware.js";
import { approvalMetrics, emitApprovalEvent, METRIC } from "../../engine/approvalMetrics.js";

type GovernanceRoutesOptions = {
  runtimeContext: RuntimeContext | null;
  runtimeTiles: LiveTile[];
  runtimeCapabilities: LiveCapabilities | null;
  canonicalSourceOptions?: Partial<CanonicalSourceOptions>;
  msGraphFetchImpl: typeof fetch;
  msGraphTokenExchangeEnabled: boolean;
  nodeEnv: string;
  evaluateRateLimit: express.RequestHandler;
  promptRateLimit: express.RequestHandler;
  pjExecuteRateLimit: express.RequestHandler;
  /** When provided, approved governed decisions are routed through the approval gate. */
  approvalStore?: ApprovalStore;
  /** When provided, chains are created alongside governed approvals. */
  chainStore?: ChainStore;
  /** When provided, authorization, chain template resolution, and audit events route through the policy provider. */
  policyProvider?: PolicyProvider;
};

export function createGovernanceRoutes(opts: GovernanceRoutesOptions): express.Router {
  const router = express.Router();
  const engine = createDefaultEngine({
    canonicalSourceOptions: opts.canonicalSourceOptions,
    policyProvider: opts.policyProvider,
  });

  // ── Identity token (with optional MS Graph exchange) ────────────────────
  router.get("/pj/identity-token", async (req, res) => {
    let auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth && opts.msGraphTokenExchangeEnabled) {
      const graphToken = extractMsGraphToken(req);
      if (graphToken) {
        try {
          const profile = await fetchMsGraphProfile(graphToken, opts.msGraphFetchImpl);
          const mapped = profile ? buildMsGraphAuthContext(profile, opts.runtimeContext, opts.nodeEnv) : null;
          if (mapped) {
            auth = mapped;
            if (opts.nodeEnv !== "production") {
              logServerInfo("pj.identity-token.exchange.msgraph", correlationId, { actorUserId: auth.userId, tenantId: auth.tenantId });
            }
          }
        } catch (error) {
          logServerError("pj.identity-token.exchange.msgraph", correlationId, error);
        }
      }
    }
    if (!auth) { res.status(401).json({ error: "Unauthorized", correlationId }); return; }

    const expiresInSeconds = 900;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const token = await signJwt(
      { sub: auth.userId, name: auth.name, role: auth.role, permissions: auth.permissions,
        tenants: auth.tenants, tenantId: auth.tenantId ?? undefined, delegations: auth.delegations },
      { expiresIn: `${expiresInSeconds}s` },
    );
    if (opts.nodeEnv !== "production") {
      logServerInfo("pj.identity-token.issued", correlationId, { actorUserId: auth.userId, tenantId: auth.tenantId, expiresAt });
    }
    res.status(200).json({ token_type: "Bearer", token, expires_in: expiresInSeconds, expires_at: expiresAt, correlationId });
  });

  // ── PJ execute ──────────────────────────────────────────────────────────
  router.post("/pj/execute", opts.pjExecuteRateLimit, requireAuthenticated(), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    if (!opts.runtimeContext) { res.status(503).json({ success: false, correlationId, error: "Runtime context unavailable" }); return; }

    const parsed = pjExecuteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, correlationId, error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const manifest = buildCapabilityManifest(auth, opts.runtimeTiles, opts.runtimeCapabilities);
    const actionDef = PJ_ACTION_DEFINITIONS.find((e) => e.id === parsed.data.actionId);
    if (!actionDef) { res.status(400).json({ success: false, correlationId, error: "Unsupported actionId" }); return; }
    if (!isPjActionAllowed(manifest, actionDef)) {
      res.status(403).json({ success: false, correlationId, error: "Forbidden",
        details: { actionId: actionDef.id, requires: actionDef.requires } });
      return;
    }

    const evaluatePayload = buildPjEvaluatePayload(auth, opts.runtimeContext, parsed.data, correlationId);
    if (parsed.data.mode === "dry-run") {
      delete evaluatePayload.action.requestId;
    } else if (!evaluatePayload.action.requestId) {
      const generated = scopedRequestId(auth.userId, auth.tenantId, `pj-${parsed.data.actionId}-${correlationId}`);
      if (generated) evaluatePayload.action.requestId = generated;
    }

    const tenantScope = assertTenantScope(auth, evaluatePayload);
    if (!tenantScope.ok) {
      res.status(403).json({ success: false, correlationId, error: "Forbidden",
        reason: tenantScope.reason, details: tenantScope.details });
      return;
    }

    try {
      const result = await engine.evaluate(evaluatePayload);
      const statusCode = resolveDecisionStatusCode(result);
      const success = statusCode === 200 && result.approved;

      // ── Approval gate: governed approved decisions require human sign-off ──
      if (
        success &&
        opts.approvalStore &&
        parsed.data.mode !== "dry-run" &&
        evaluatePayload.action.mode === "governed"
      ) {
        try {
          const approval = opts.approvalStore.create({
            requestId: evaluatePayload.action.requestId ?? `pj-${correlationId}`,
            operatorId: auth.userId,
            workspaceId: evaluatePayload.workspace.id,
            municipalityId: evaluatePayload.municipality.id,
            actionIntent: evaluatePayload.action.intent,
            actionMode: evaluatePayload.action.mode,
            planHash: result.auditRecord.planHash,
            planSteps: result.actionPlan,
            auditRecord: result.auditRecord,
            decisionResult: result,
          });
          approvalMetrics.increment(METRIC.APPROVALS_CREATED);
          approvalMetrics.incrementGauge(METRIC.PENDING_GAUGE);

          // Create chain steps for this approval
          if (opts.chainStore) {
            try {
              let templateId: string | undefined;
              if (opts.policyProvider) {
                const resolved = opts.policyProvider.getChainTemplate({
                  actionIntent: evaluatePayload.action.intent,
                  actionMode: evaluatePayload.action.mode ?? "governed",
                  municipalityId: evaluatePayload.municipality.id,
                  workspaceId: evaluatePayload.workspace.id,
                });
                if (resolved) templateId = resolved.id;
              }
              opts.chainStore.createChainForApproval(approval.id, templateId);
            } catch {
              // Chain creation failure is non-fatal — approval still exists
            }
          }

          // Write audit event through policy provider
          if (opts.policyProvider) {
            try {
              opts.policyProvider.writeAuditEvent({
                eventId: crypto.randomUUID(),
                eventType: "approval_created",
                workspaceId: evaluatePayload.workspace.id,
                operatorId: auth.userId,
                municipalityId: evaluatePayload.municipality.id,
                timestamp: new Date().toISOString(),
                intent: evaluatePayload.action.intent,
                outcome: "pending",
                details: {
                  approvalId: approval.id,
                  planHash: result.auditRecord.planHash,
                  correlationId,
                },
              });
            } catch {
              // Audit write failure is non-fatal
            }
          }

          emitApprovalEvent("created", {
            approvalId: approval.id, operatorId: auth.userId,
            intent: evaluatePayload.action.intent, planHash: result.auditRecord.planHash,
            correlationId,
          });
          logServerInfo("pj.execute.approval_created", correlationId, {
            approvalId: approval.id, operatorId: auth.userId, intent: evaluatePayload.action.intent,
          });
          res.status(202).json({
            success: true,
            correlationId,
            approvalRequired: true,
            approvalId: approval.id,
            approvalStatus: "pending",
            data: buildPjExecuteData(parsed.data, evaluatePayload, result),
            warnings: result.warnings,
            message: "Decision approved by engine but requires human sign-off before dispatch.",
          });
          return;
        } catch (approvalError) {
          logServerError("pj.execute.approval_create_failed", correlationId, approvalError);
          // Fall through to normal response if approval creation fails
          // (e.g., duplicate requestId means the approval already exists)
        }
      }

      res.status(statusCode).json({ success, correlationId,
        data: buildPjExecuteData(parsed.data, evaluatePayload, result), warnings: result.warnings });
    } catch (error) {
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ success: false, correlationId, error: "Internal server error" });
    }
  });

  // ── Prompt (admin-only) ─────────────────────────────────────────────────
  router.get("/prompt", opts.promptRateLimit, requireRole("admin"), (req, res) => {
    try {
      const content = getSystemPromptText();
      res.json({ title: "PuddleJumper Product & System Prompt", version: "0.1",
        classification: "Internal / Engineering", systemPromptVersion: engine.systemPromptVersion, content });
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  // ── Core prompt (authenticated) ────────────────────────────────────────
  router.get("/core-prompt", opts.promptRateLimit, requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    try {
      const content = getSystemPromptText();
      const isAdmin = auth.role === "admin";
      const responseContent = isAdmin ? content : summarizePrompt(content);
      res.json({ title: "PuddleJumper Product & System Prompt", version: "0.1",
        classification: isAdmin ? "Internal / Engineering" : "Internal / Summary",
        systemPromptVersion: engine.systemPromptVersion,
        mode: isAdmin ? "full" : "summary", editable: isAdmin, redacted: !isAdmin, content: responseContent });
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  // ── Evaluate ────────────────────────────────────────────────────────────
  router.post("/evaluate", opts.evaluateRateLimit, requirePermission("deploy"), async (req, res) => {
    const auth = getAuthContext(req);
    if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
    const parsed = evaluateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request payload",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      return;
    }
    const payload = {
      ...parsed.data,
      operator: { ...parsed.data.operator, id: auth.userId, name: auth.name,
        role: auth.role, permissions: auth.permissions, delegations: auth.delegations },
      action: { ...parsed.data.action,
        requestId: scopedRequestId(auth.userId, auth.tenantId, parsed.data.action.requestId) ??
          `${auth.userId}:${auth.tenantId ?? "no-tenant"}:auto-${crypto.randomUUID()}` },
    };

    const tenantScope = assertTenantScope(auth, payload);
    if (!tenantScope.ok) {
      res.status(403).json({ error: "Forbidden", reason: tenantScope.reason, details: tenantScope.details });
      return;
    }

    try {
      const result = await engine.evaluate(payload);
      if (!result.approved) {
        if (result.warnings.some((w) => /idempotency conflict|schema version mismatch/i.test(w))) { res.status(409).json(result); return; }
        if (result.warnings.some((w) => /invalid canonical source|canonical/i.test(w))) { res.status(400).json(result); return; }
        res.status(400).json(result); return;
      }
      res.status(200).json(result);
    } catch (error) {
      const correlationId = getCorrelationId(res);
      logServerError(`${req.method} ${req.path}`, correlationId, error);
      res.status(500).json({ error: "Internal server error", correlationId });
    }
  });

  return router;
}
