// ── Workspace Role Enforcement Middleware ─────────────────────────────
//
// Checks that the authenticated user has one of the allowed roles in their
// workspace. Returns 403 if the user lacks the required role.
//
import type { Request, Response, NextFunction } from "express";
import { getAuthContext } from "@publiclogic/core";
import { getMemberRole, type WorkspaceRole } from "../../engine/workspaceStore.js";
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
    let role = getMemberRole(dataDir, auth.workspaceId, auth.sub);
    
    // Fallback: if no workspace member record exists, check JWT role (for backward compatibility)
    if (!role && auth.role) {
      // Map JWT role to workspace role
      if (auth.role === "admin") {
        role = "owner"; // Treat legacy admin as owner
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
