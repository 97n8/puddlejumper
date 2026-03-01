// ── Public PRR Routes ──────────────────────────────────────────────────
//
// Public-facing endpoints for PRR submission and status check (no auth).
// workspace_id is NEVER accepted from the client — it is resolved server-side
// from PUBLIC_PRR_WORKSPACE_ID env var to prevent cross-workspace spam.
//
import express from "express";
import { getCorrelationId } from "../serverMiddleware.js";
import { createPRR, getPRRByToken, listPRRComments } from "../../engine/prrStore.js";
import { getWorkspace } from "../../engine/workspaceStore.js";

const MAX_SUMMARY_LENGTH = 500;
const MAX_DETAILS_LENGTH = 5000;
const MAX_NOTE_LENGTH = 2000;

export function createPublicPRRRoutes(opts?: { dataDir?: string; workspaceId?: string }): express.Router {
  const router = express.Router();
  const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
  // Workspace is configured server-side only — never trust client-supplied value
  const configuredWorkspaceId = opts?.workspaceId ?? process.env.PUBLIC_PRR_WORKSPACE_ID ?? "";

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

    // Validate workspace exists
    const ws = getWorkspace(dataDir, configuredWorkspaceId);
    if (!ws) {
      res.status(503).json({ success: false, correlationId, error: "Workspace not found" });
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
      const prr = createPRR(dataDir, {
        workspace_id: configuredWorkspaceId, // always server-controlled
        name,
        email,
        summary: summary.trim(),
        details,
        attachments
      });

      res.status(201).json({
        success: true,
        correlationId,
        data: {
          id: prr.id,
          public_token: prr.public_token,
          status: prr.status,
          created_at: prr.created_at
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

    if (!token || typeof token !== "string" || token.length > 128) {
      res.status(400).json({ success: false, correlationId, error: "Invalid token" });
      return;
    }

    try {
      const prr = getPRRByToken(dataDir, token);

      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }

      const allComments = listPRRComments(dataDir, prr.id);
      const comments = allComments.map(c => ({
        body: c.body,
        created_at: c.created_at,
        is_admin: !!c.user_id
      }));

      res.json({
        success: true,
        correlationId,
        data: {
          summary: prr.summary,
          details: prr.details,
          status: prr.status,
          created_at: prr.created_at,
          updated_at: prr.updated_at,
          comments
        }
      });
    } catch (error: unknown) {
      res.status(500).json({ success: false, correlationId, error: "Failed to retrieve PRR" });
    }
  });

  return router;
}
