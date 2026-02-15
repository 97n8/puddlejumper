// ── Workspace Collaboration Routes ─────────────────────────────────────
//
// Multi-user collaboration endpoints:
//   - Invite members
//   - Accept invitations
//   - List/remove members
//   - Update member roles
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import { requireRole } from "../middleware/checkWorkspaceRole.js";
import { enforceTierLimit } from "../middleware/enforceTierLimit.js";
import {
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
  getInvitationByToken,
  acceptInvitation,
  listWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  getMemberRole,
} from "../../engine/workspaceStore.js";

export function createWorkspaceCollaborationRoutes(): express.Router {
  const router = express.Router();
  const dataDir = process.env.DATA_DIR || "./data";

  // POST /api/workspace/invite - Create invitation (owner/admin only)
  router.post("/workspace/invite", requireAuthenticated(), requireRole("owner", "admin"), enforceTierLimit("member"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ success: false, correlationId, error: "email and role required" });
      return;
    }

    if (!["admin", "member", "viewer"].includes(role)) {
      res.status(400).json({ success: false, correlationId, error: "Invalid role" });
      return;
    }

    const invitation = createInvitation(dataDir, auth!.workspaceId, email, role, auth!.sub);
    res.json({ success: true, correlationId, data: invitation });
  });

  // GET /api/workspace/invitations - List pending invitations
  router.get("/workspace/invitations", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const invitations = listPendingInvitations(dataDir, auth!.workspaceId);
    res.json({ success: true, correlationId, data: invitations });
  });

  // DELETE /api/workspace/invitations/:id - Revoke invitation
  router.delete("/workspace/invitations/:id", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const correlationId = getCorrelationId(res);
    revokeInvitation(dataDir, req.params.id);
    res.json({ success: true, correlationId });
  });

  // POST /api/invitations/:token/accept - Accept invitation
  router.post("/invitations/:token/accept", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    const result = acceptInvitation(dataDir, req.params.token, auth!.sub);
    
    if (!result) {
      res.status(404).json({ success: false, correlationId, error: "Invitation not found" });
      return;
    }
    
    if (result.error === "expired") {
      res.status(410).json({ success: false, correlationId, error: "Invitation expired" });
      return;
    }
    
    res.json({ success: true, correlationId, data: result });
  });

  // GET /api/workspace/members - List members
  router.get("/workspace/members", requireAuthenticated(), requireRole("owner", "admin", "member", "viewer"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const members = listWorkspaceMembers(dataDir, auth!.workspaceId);
    res.json({ success: true, correlationId, data: members });
  });

  // PATCH /api/workspace/members/:userId - Update member role (owner only)
  router.patch("/workspace/members/:userId", requireAuthenticated(), requireRole("owner"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const { role } = req.body;

    if (!["owner", "admin", "member", "viewer"].includes(role)) {
      res.status(400).json({ success: false, correlationId, error: "Invalid role" });
      return;
    }

    updateMemberRole(dataDir, auth!.workspaceId, req.params.userId, role);
    res.json({ success: true, correlationId });
  });

  // DELETE /api/workspace/members/:userId - Remove member (owner/admin, not self)
  router.delete("/workspace/members/:userId", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);

    if (req.params.userId === auth!.sub) {
      res.status(400).json({ success: false, correlationId, error: "Cannot remove yourself. Use /workspace/leave instead." });
      return;
    }

    const targetRole = getMemberRole(dataDir, auth!.workspaceId, req.params.userId);
    if (targetRole === "owner") {
      res.status(403).json({ success: false, correlationId, error: "Cannot remove owner" });
      return;
    }

    removeWorkspaceMember(dataDir, auth!.workspaceId, req.params.userId);
    res.json({ success: true, correlationId });
  });

  // POST /api/workspace/leave - Leave workspace (non-owners)
  router.post("/workspace/leave", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);

    const role = getMemberRole(dataDir, auth!.workspaceId, auth!.sub);
    if (role === "owner") {
      res.status(400).json({ success: false, correlationId, error: "Owner cannot leave. Transfer ownership first." });
      return;
    }

    removeWorkspaceMember(dataDir, auth!.workspaceId, auth!.sub);
    res.json({ success: true, correlationId });
  });

  return router;
}
