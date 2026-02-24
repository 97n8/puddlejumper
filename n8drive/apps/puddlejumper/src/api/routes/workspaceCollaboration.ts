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
  getWorkspace,
  getDb,
} from "../../engine/workspaceStore.js";
import { sendInviteEmail } from "../email.js";

export function createWorkspaceCollaborationRoutes(): express.Router {
  const router = express.Router();
  const dataDir = process.env.DATA_DIR || "./data";

  // POST /api/workspace/invite - Create invitation (owner/admin only)
  router.post("/workspace/invite", requireAuthenticated(), requireRole("owner", "admin"), async (req, res) => {
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

    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { toolAccess } = req.body; // optional: string[] | null
    const invitation = createInvitation(dataDir, workspaceId, email, role, auth!.sub, toolAccess ?? null);

    // Send invite email (fire-and-forget — don't fail the request if email fails)
    const ws = getWorkspace(dataDir, workspaceId);
    const loginUrl = `${process.env.LOGIC_COMMONS_URL || "https://os.publiclogic.org"}?invite=${invitation.token}`;
    sendInviteEmail({
      toEmail: email,
      inviterName: auth!.name || auth!.email || "Your admin",
      workspaceName: ws?.name || "PublicLogic",
      role,
      loginUrl,
    }).catch((err: unknown) => console.error("[email] invite send failed:", err));

    res.json({ success: true, correlationId, data: invitation });
  });

  // GET /api/workspace/invitations - List pending invitations
  router.get("/workspace/invitations", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const invitations = listPendingInvitations(dataDir, auth!.tenantId ?? auth!.workspaceId);
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
    const members = listWorkspaceMembers(dataDir, auth!.tenantId ?? auth!.workspaceId);
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

    updateMemberRole(dataDir, auth!.tenantId ?? auth!.workspaceId, req.params.userId, role);
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

    const targetRole = getMemberRole(dataDir, auth!.tenantId ?? auth!.workspaceId, req.params.userId);
    if (targetRole === "owner") {
      res.status(403).json({ success: false, correlationId, error: "Cannot remove owner" });
      return;
    }

    removeWorkspaceMember(dataDir, auth!.tenantId ?? auth!.workspaceId, req.params.userId);
    res.json({ success: true, correlationId });
  });

  // POST /api/workspace/leave - Leave workspace (non-owners)
  router.post("/workspace/leave", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);

    const role = getMemberRole(dataDir, auth!.tenantId ?? auth!.workspaceId, auth!.sub);
    if (role === "owner") {
      res.status(400).json({ success: false, correlationId, error: "Owner cannot leave. Transfer ownership first." });
      return;
    }

    removeWorkspaceMember(dataDir, auth!.tenantId ?? auth!.workspaceId, auth!.sub);
    res.json({ success: true, correlationId });
  });

  // GET /api/workspace/me - Current user's membership (role + tool_access)
  router.get("/workspace/me", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const db = getDb(dataDir);
    const row = db.prepare(`SELECT role, tool_access FROM workspace_members WHERE workspace_id = ? AND user_id = ?`).get(workspaceId, auth!.sub) as { role: string; tool_access: string | null } | undefined;
    res.json({
      success: true,
      correlationId,
      data: {
        workspaceId,
        role: row?.role ?? null,
        toolAccess: row?.tool_access ? JSON.parse(row.tool_access) : null,
      },
    });
  });

  return router;
}
