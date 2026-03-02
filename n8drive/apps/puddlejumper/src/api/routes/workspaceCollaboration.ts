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
  updateMemberToolAccess,
  getMemberRole,
  getWorkspace,
  getDb,
  getToolPermissions,
  setToolPermissions,
  listToolPermissionsForMember,
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

  // GET /api/invitations/:token - Peek at invite details (no auth required, no side effects)
  router.get("/invitations/:token", (req, res) => {
    const correlationId = getCorrelationId(res);
    const invitation: any = getInvitationByToken(dataDir, req.params.token);
    if (!invitation) {
      res.status(404).json({ success: false, correlationId, error: "Invitation not found" });
      return;
    }
    if (invitation.accepted_at) {
      res.status(410).json({ success: false, correlationId, error: "Invitation already accepted" });
      return;
    }
    if (new Date(invitation.expires_at) < new Date()) {
      res.status(410).json({ success: false, correlationId, error: "Invitation expired" });
      return;
    }
    const ws = getWorkspace(dataDir, invitation.workspace_id);
    res.json({
      success: true,
      correlationId,
      data: {
        email: invitation.email,
        role: invitation.role,
        workspaceName: ws?.name ?? "PublicLogic",
        expiresAt: invitation.expires_at,
      },
    });
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

  // PATCH /api/workspace/members/:userId - Update member role and/or tool access (owner only)
  router.patch("/workspace/members/:userId", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { role, toolAccess } = req.body;

    if (role !== undefined) {
      if (!["owner", "admin", "member", "viewer"].includes(role)) {
        res.status(400).json({ success: false, correlationId, error: "Invalid role" });
        return;
      }
      updateMemberRole(dataDir, workspaceId, req.params.userId, role, auth!.sub);
    }

    if (toolAccess !== undefined) {
      // null = no access, array = specific tools
      updateMemberToolAccess(dataDir, workspaceId, req.params.userId, toolAccess, auth!.sub);
    }

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

    removeWorkspaceMember(dataDir, auth!.tenantId ?? auth!.workspaceId, req.params.userId, auth!.sub);
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

    removeWorkspaceMember(dataDir, auth!.tenantId ?? auth!.workspaceId, auth!.sub, auth!.sub);
    res.json({ success: true, correlationId });
  });

  // GET /api/workspace/me - Current user's membership (role + tool_access)
  // Looks across all workspaces — prefers an invited membership over personal owner entry.
  router.get("/workspace/me", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const db = getDb(dataDir);
    // Get all memberships for this user, prefer non-owner roles (invited workspaces)
    const rows = db.prepare(
      `SELECT workspace_id, role, tool_access FROM workspace_members WHERE user_id = ?
       ORDER BY CASE role WHEN 'owner' THEN 99 ELSE 0 END ASC`
    ).all(auth!.sub) as Array<{ workspace_id: string; role: string; tool_access: string | null }>;

    // Use first non-owner row if present, else fall back to owner (personal workspace)
    const row = rows.find(r => r.role !== 'owner') ?? rows[0];
    res.json({
      success: true,
      correlationId,
      data: {
        workspaceId: row?.workspace_id ?? (auth!.tenantId ?? auth!.workspaceId),
        role: row?.role ?? null,
        toolAccess: row?.tool_access ? JSON.parse(row.tool_access) : null,
      },
    });
  });

  // ── Per-Tool Internal Permissions ──────────────────────────────────────
  // These endpoints let each tool manage its own internal role model.
  // LogicOS admin UI only assigns which tools a user can access;
  // each tool self-manages internal permissions via these endpoints.

  // GET /api/workspace/members/:userId/tool-permissions/:toolId
  // Returns the permissions array a tool has stored for this member.
  // Callable by the tool backend (admin or owner) or the user themselves.
  router.get("/workspace/members/:userId/tool-permissions/:toolId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId, toolId } = req.params;

    // User can read their own; admin/owner can read anyone's
    const callerRole = getMemberRole(dataDir, workspaceId, auth!.sub);
    if (auth!.sub !== userId && callerRole !== "owner" && callerRole !== "admin" && auth!.role !== "admin") {
      res.status(403).json({ success: false, correlationId, error: "Insufficient permissions" });
      return;
    }

    const permissions = getToolPermissions(dataDir, workspaceId, userId, toolId);
    res.json({ success: true, correlationId, data: { userId, toolId, permissions } });
  });

  // GET /api/workspace/members/:userId/tool-permissions
  // Returns all per-tool permissions for a member (admin/owner only).
  router.get("/workspace/members/:userId/tool-permissions", requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId } = req.params;

    const toolPermissions = listToolPermissionsForMember(dataDir, workspaceId, userId);
    res.json({ success: true, correlationId, data: { userId, toolPermissions } });
  });

  // PATCH /api/workspace/members/:userId/tool-permissions/:toolId
  // Set internal permissions for a member in a specific tool.
  // Intended to be called by the tool's own admin UI — not the LogicOS admin panel.
  // Requires workspace admin/owner or a tool-level admin passing x-tool-admin: true.
  router.patch("/workspace/members/:userId/tool-permissions/:toolId", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId, toolId } = req.params;
    const { permissions } = req.body as { permissions: string[] };

    if (!Array.isArray(permissions) || permissions.some(p => typeof p !== "string")) {
      res.status(400).json({ success: false, correlationId, error: "permissions must be an array of strings" });
      return;
    }

    const callerRole = getMemberRole(dataDir, workspaceId, auth!.sub);
    const isWorkspaceAdmin = callerRole === "owner" || callerRole === "admin" || auth!.role === "admin";
    // Tools may pass x-tool-admin header to indicate the caller has tool-level admin rights
    const isToolAdmin = req.headers["x-tool-admin"] === "true";

    if (!isWorkspaceAdmin && !isToolAdmin) {
      res.status(403).json({ success: false, correlationId, error: "Insufficient permissions" });
      return;
    }

    setToolPermissions(dataDir, workspaceId, userId, toolId, permissions, auth!.sub);
    res.json({ success: true, correlationId, data: { userId, toolId, permissions } });
  });

  return router;
}
