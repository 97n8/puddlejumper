// ── Tier Limit Enforcement Middleware ─────────────────────────────
//
// Checks workspace usage against tier limits and returns 403 when exceeded.
// Wire this into POST routes for resource creation.
//

import type { Request, Response, NextFunction } from "express";
import { getAuthContext } from "@publiclogic/core";
import { getWorkspace, type WorkspaceRow } from "../../engine/workspaceStore.js";
import { getTierLimits } from "../../config/tierLimits.js";
import { getCorrelationId } from "../serverMiddleware.js";

type TierResource = "template" | "approval" | "member";

export function enforceTierLimit(resource: TierResource) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }

    const dataDir = process.env.DATA_DIR || "./data";
    const workspace = getWorkspace(dataDir, auth.workspaceId);
    
    // If workspace doesn't exist, skip enforcement (legacy/test behavior)
    if (!workspace) {
      next();
      return;
    }

    const limits = getTierLimits(workspace.plan);
    const currentCount = getCurrentCount(workspace, resource);
    const limit = getLimit(limits, resource);

    if (limit >= 0 && currentCount >= limit) {
      res.status(403).json({
        success: false,
        correlationId,
        error: "tier_limit",
        plan: workspace.plan,
        limit,
        current: currentCount,
        upgrade_url: "/upgrade",
      });
      return;
    }

    next();
  };
}

function getCurrentCount(workspace: WorkspaceRow, resource: TierResource): number {
  switch (resource) {
    case "template":
      return workspace.template_count || 0;
    case "approval":
      return workspace.approval_count || 0;
    case "member":
      return workspace.member_count || 1;
  }
}

function getLimit(limits: ReturnType<typeof getTierLimits>, resource: TierResource): number {
  switch (resource) {
    case "template":
      return limits.templates;
    case "approval":
      return limits.approvals;
    case "member":
      return limits.members;
  }
}
