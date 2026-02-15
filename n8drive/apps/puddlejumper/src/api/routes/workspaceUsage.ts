// ── Workspace Usage Routes ──────────────────────────────────────────────
//
// Endpoint for checking workspace tier limits and current usage.
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getWorkspace } from "../../engine/workspaceStore.js";
import { getTierLimits } from "../../config/tierLimits.js";
import { getCorrelationId } from "../serverMiddleware.js";

export function createWorkspaceUsageRoutes(): express.Router {
  const router = express.Router();
  
  router.get("/workspace/usage", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    
    const dataDir = process.env.DATA_DIR || "./data";
    const workspace = getWorkspace(dataDir, auth.workspaceId);
    if (!workspace) { res.status(404).json({ success: false, correlationId, error: "Workspace not found" }); return; }
    
    const limits = getTierLimits(workspace.plan);
    const usage = {
      templates: workspace.template_count,
      approvals: workspace.approval_count,
      members: workspace.member_count,
    };
    
    const atLimit = usage.templates >= limits.templates || 
                   usage.approvals >= limits.approvals || 
                   usage.members >= limits.members;
    
    res.json({
      success: true,
      correlationId,
      data: { plan: workspace.plan, limits, usage, at_limit: atLimit },
    });
  });
  
  return router;
}
