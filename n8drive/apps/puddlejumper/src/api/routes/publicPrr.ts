// ── Public PRR Routes ──────────────────────────────────────────────────
//
// Public-facing endpoints for PRR submission and status check (no auth).
// workspace_id is NEVER accepted from the client — it is resolved server-side
// from PUBLIC_PRR_WORKSPACE_ID env var to prevent cross-workspace spam.
//
import express from "express";
import { getCorrelationId } from "../serverMiddleware.js";
import type { PrrStore } from "../prrStore.js";

const MAX_SUMMARY_LENGTH = 500;
const MAX_DETAILS_LENGTH = 5000;

// Simple in-memory rate limiter: max 10 token lookups per IP per 60s
const tokenLookupCounts = new Map<string, { count: number; resetAt: number }>();
function isTokenLookupRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = tokenLookupCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    tokenLookupCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 10;
}

export function createPublicPRRRoutes(opts: { prrStore: PrrStore; workspaceId?: string }): express.Router {
  const router = express.Router();
  // Workspace is configured server-side only — never trust client-supplied value
  const configuredWorkspaceId = opts.workspaceId ?? process.env.PUBLIC_PRR_WORKSPACE_ID ?? "";

  // POST /public/prr - Submit a new PRR (public, no auth)
  router.post("/public/prr", (req, res) => {
    const correlationId = getCorrelationId(res);

    if (!configuredWorkspaceId) {
      res.status(503).json({
        success: false,
        correlationId,
        error: "PRR submissions are not configured for this workspace"
      });
      return;
    }

    const { name, email, summary, details, attachments } = req.body;

    if (!summary || typeof summary !== "string" || summary.trim().length === 0) {
      res.status(400).json({ success: false, correlationId, error: "Summary is required" });
      return;
    }
    if (summary.length > MAX_SUMMARY_LENGTH) {
      res.status(400).json({ success: false, correlationId, error: `Summary must be ${MAX_SUMMARY_LENGTH} characters or fewer` });
      return;
    }
    if (details && typeof details === "string" && details.length > MAX_DETAILS_LENGTH) {
      res.status(400).json({ success: false, correlationId, error: `Details must be ${MAX_DETAILS_LENGTH} characters or fewer` });
      return;
    }

    try {
      const prr = opts.prrStore.intake({
        tenantId: configuredWorkspaceId,
        requesterName: typeof name === "string" ? name : null,
        requesterEmail: typeof email === "string" ? email : null,
        subject: summary.trim(),
        description: typeof details === "string" ? details : null,
        actorUserId: "public",
        metadata: {
          source: "public.prr",
          attachments: Array.isArray(attachments) ? attachments : [],
        }
      });

      res.status(201).json({
        success: true,
        correlationId,
        data: {
          id: prr.id,
          public_token: prr.public_id,
          status: prr.status,
          created_at: prr.received_at
        }
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, correlationId, error: "Failed to create PRR" });
    }
  });

  // GET /public/prr/:token - Check PRR status (public, no auth)
  router.get("/public/prr/:token", (req, res) => {
    const correlationId = getCorrelationId(res);
    const { token } = req.params;

    const clientIp = req.ip ?? "unknown";
    if (isTokenLookupRateLimited(clientIp)) {
      res.status(429).json({ success: false, correlationId, error: "Too many requests" });
      return;
    }

    if (!token || typeof token !== "string" || token.length > 128) {
      res.status(400).json({ success: false, correlationId, error: "Invalid token" });
      return;
    }

    try {
      const prr = opts.prrStore.getPublicStatus(token);

      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }

      res.json({
        success: true,
        correlationId,
        data: {
          summary: prr.summary,
          details: prr.details,
          status: prr.status,
          created_at: prr.created_at,
          updated_at: prr.updated_at,
          comments: []
        }
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, correlationId, error: "Failed to retrieve PRR" });
    }
  });

  return router;
}
