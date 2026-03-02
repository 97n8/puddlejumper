// ── Workspace Role Enforcement Middleware ─────────────────────────────
//
// Checks that the authenticated user has one of the allowed roles in their
// workspace. Returns 403 if the user lacks the required role.
//
import type { Request, Response, NextFunction } from "express";
import { getAuthContext } from "@publiclogic/core";
import { getMemberRole, getMemberToolAccess, getWorkspace, getWorkspaceForMember, type WorkspaceRole } from "../../engine/workspaceStore.js";
import { getCorrelationId } from "../serverMiddleware.js";

export function requireRole(...allowedRoles: WorkspaceRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }

    const dataDir = process.env.DATA_DIR || "./data";
    const workspaceId = auth.workspaceId ?? auth.tenantId;
    let role = getMemberRole(dataDir, workspaceId, auth.sub);
    
    // Fallback: if no workspace member record, check if user is the workspace owner
    if (!role) {
      const ws = getWorkspace(dataDir, workspaceId);
      if (ws && ws.owner_id === auth.sub) {
        role = "owner";
      } else if (auth.role === "admin") {
        role = "owner";
      } else {
        // JWT had no tenantId — look up membership table as fallback for invited members
        const membership = getWorkspaceForMember(dataDir, auth.sub);
        if (membership) role = membership.role;
      }
    }
    
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ 
        success: false, 
        correlationId, 
        error: "Insufficient permissions",
        required_role: allowedRoles,
        your_role: role || "none"
      });
      return;
    }

    // Attach role to request for downstream use
    (req as any).workspaceRole = role;
    next();
  };
}

/**
 * requireToolAccess(toolKey)
 *
 * Ensures the authenticated user has been granted access to the named tool
 * within their workspace. Owner and admin always pass through.
 * Members with no explicit tool_access list pass through (open by default).
 * Viewers and members with an explicit list must be included in it.
 */
export function requireToolAccess(toolKey: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);

    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }

    const dataDir = process.env.DATA_DIR || "./data";
    const workspaceId = auth.workspaceId ?? auth.tenantId;

    // System admins and workspace owners/admins always have access
    if (auth.role === "admin") { next(); return; }

    const role = getMemberRole(dataDir, workspaceId, auth.sub);
    if (role === "owner" || role === "admin") { next(); return; }

    const toolAccess = getMemberToolAccess(dataDir, workspaceId, auth.sub);

    // member with no explicit tool_access list → full non-admin access
    if (role === "member" && toolAccess === null) { next(); return; }

    if (!toolAccess || !toolAccess.includes(toolKey)) {
      res.status(403).json({
        success: false,
        correlationId,
        error: "Tool access denied",
        tool: toolKey,
        your_role: role ?? "none",
      });
      return;
    }

    next();
  };
}
