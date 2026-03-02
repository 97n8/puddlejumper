// ── Admin Member Management Routes ──────────────────────────────────────────
//
// Full CRUD for workspace members — admins can create local (password-based)
// user accounts directly, assign tools and roles, and reset passwords.
// Users then log in and self-manage their own account connections.
//
//   GET    /api/admin/members                    — list all workspace members
//   POST   /api/admin/members                    — create a local user + add to workspace
//   PATCH  /api/admin/members/:userId/role        — update workspace role
//   PATCH  /api/admin/members/:userId/tools       — update tool_access list
//   PATCH  /api/admin/members/:userId/password    — admin reset password (→ must_change)
//   PATCH  /api/admin/members/:userId/profile     — update name / email
//   DELETE /api/admin/members/:userId             — remove from workspace (+ optional account delete)

import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import { requireRole } from "../middleware/checkWorkspaceRole.js";
import {
  listWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole,
  updateMemberToolAccess,
  getMemberRole,
  getWorkspace,
  getDb,
} from "../../engine/workspaceStore.js";
import {
  createLocalUser,
  adminResetPassword,
  listLocalUsers,
  findLocalUserById,
  deleteLocalUser,
  updateLocalUser,
} from "../localUsersStore.js";
import { logToolEvent } from "@publiclogic/logic-commons";

const DATA_DIR = () => process.env.DATA_DIR || "./data";

export function createAdminMembersRoutes(): express.Router {
  const router = express.Router();

  // ── GET /api/admin/members ──────────────────────────────────────────────
  // Returns all workspace members with their role, tool_access, and account type.
  // Merges local_users metadata with workspace_members records.
  router.get("/admin/members", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;

    const members = listWorkspaceMembers(dataDir, workspaceId) as Array<{
      id: string; workspace_id: string; user_id: string; role: string;
      tool_access: string | null; invited_by: string | null; joined_at: string;
    }>;

    // Merge local_users metadata for local accounts
    const localUsers = listLocalUsers(dataDir);
    const localById = new Map(localUsers.map(u => [u.id, u]));

    // Also pull OAuth user names/emails from users.db
    const db = getDb(dataDir);
    const oauthRows = db.prepare("SELECT sub, email, name, provider FROM users").all() as Array<{
      sub: string; email: string | null; name: string | null; provider: string;
    }>;
    const oauthBySub = new Map(oauthRows.map(r => [r.sub, r]));

    const enriched = members.map(m => {
      const local = localById.get(m.user_id);
      const oauth = oauthBySub.get(m.user_id);
      return {
        userId: m.user_id,
        workspaceMemberId: m.id,
        role: m.role,
        toolAccess: m.tool_access ? JSON.parse(m.tool_access) : null,
        invitedBy: m.invited_by,
        joinedAt: m.joined_at,
        accountType: local ? "local" : "oauth",
        name: local?.name ?? oauth?.name ?? null,
        email: local?.email ?? oauth?.email ?? null,
        provider: oauth?.provider ?? null,
        username: local?.username ?? null,
        mustChangePassword: local?.must_change_password === 1,
      };
    });

    res.json({ success: true, correlationId, data: enriched });
  });

  // ── POST /api/admin/members ─────────────────────────────────────────────
  // Create a local user account and immediately add them to the workspace.
  // Body: { username, name, email?, temporaryPassword, role, toolAccess? }
  router.post("/admin/members", requireAuthenticated(), requireRole("owner", "admin"), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;

    const { username, name, email, temporaryPassword, role, toolAccess } = req.body as {
      username?: string; name?: string; email?: string | null;
      temporaryPassword?: string; role?: string; toolAccess?: string[] | null;
    };

    if (!username?.trim()) {
      res.status(400).json({ success: false, correlationId, error: "username is required" }); return;
    }
    if (!name?.trim()) {
      res.status(400).json({ success: false, correlationId, error: "name is required" }); return;
    }
    if (!temporaryPassword || temporaryPassword.length < 8) {
      res.status(400).json({ success: false, correlationId, error: "temporaryPassword must be at least 8 characters" }); return;
    }
    const validRoles = ["member", "viewer", "admin"];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ success: false, correlationId, error: `role must be one of: ${validRoles.join(", ")}` }); return;
    }

    try {
      const localUser = await createLocalUser(dataDir, {
        username, name, email: email ?? null, temporaryPassword, createdBy: auth!.sub,
      });

      // Add to workspace
      addWorkspaceMember(dataDir, workspaceId, localUser.id, role, auth!.sub, toolAccess ?? null);

      logToolEvent({ tool: "admin", action: "member_created", actorId: auth!.sub, resourceId: localUser.id,
        meta: { username, role, workspaceId } });

      res.status(201).json({
        success: true, correlationId,
        data: {
          userId: localUser.id, username: localUser.username, name: localUser.name,
          email: localUser.email, role, toolAccess: toolAccess ?? null, mustChangePassword: true,
          accountType: "local",
        },
      });
    } catch (err: any) {
      if (err?.message?.includes("UNIQUE constraint failed: local_users.username")) {
        res.status(409).json({ success: false, correlationId, error: "Username already exists" }); return;
      }
      console.error("[admin/members] create error:", err);
      res.status(500).json({ success: false, correlationId, error: "Failed to create member" });
    }
  });

  // ── PATCH /api/admin/members/:userId/role ──────────────────────────────
  router.patch("/admin/members/:userId/role", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId } = req.params;
    const { role } = req.body as { role?: string };

    const validRoles = ["member", "viewer", "admin"];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ success: false, correlationId, error: `role must be one of: ${validRoles.join(", ")}` }); return;
    }

    // Prevent demoting the workspace owner
    const ws = getWorkspace(dataDir, workspaceId);
    if (ws?.owner_id === userId) {
      res.status(403).json({ success: false, correlationId, error: "Cannot change the workspace owner's role" }); return;
    }

    updateMemberRole(dataDir, workspaceId, userId, role, auth!.sub);
    logToolEvent({ tool: "admin", action: "member_role_changed", actorId: auth!.sub, resourceId: userId,
      meta: { role, workspaceId } });
    res.json({ success: true, correlationId, data: { userId, role } });
  });

  // ── PATCH /api/admin/members/:userId/tools ─────────────────────────────
  router.patch("/admin/members/:userId/tools", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId } = req.params;
    const { toolAccess } = req.body as { toolAccess?: string[] | null };

    if (toolAccess !== null && toolAccess !== undefined && !Array.isArray(toolAccess)) {
      res.status(400).json({ success: false, correlationId, error: "toolAccess must be an array of tool IDs or null" }); return;
    }

    updateMemberToolAccess(dataDir, workspaceId, userId, toolAccess ?? null, auth!.sub);
    logToolEvent({ tool: "admin", action: "member_tools_updated", actorId: auth!.sub, resourceId: userId,
      meta: { toolAccess, workspaceId } });
    res.json({ success: true, correlationId, data: { userId, toolAccess: toolAccess ?? null } });
  });

  // ── PATCH /api/admin/members/:userId/password ──────────────────────────
  // Admin sets a new temporary password; user must change it on next login.
  router.patch("/admin/members/:userId/password", requireAuthenticated(), requireRole("owner", "admin"), async (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const { userId } = req.params;
    const { temporaryPassword } = req.body as { temporaryPassword?: string };

    if (!temporaryPassword || temporaryPassword.length < 8) {
      res.status(400).json({ success: false, correlationId, error: "temporaryPassword must be at least 8 characters" }); return;
    }

    const user = findLocalUserById(dataDir, userId);
    if (!user) {
      res.status(404).json({ success: false, correlationId, error: "User not found or is not a local account" }); return;
    }

    await adminResetPassword(dataDir, userId, temporaryPassword);
    logToolEvent({ tool: "admin", action: "member_password_reset", actorId: auth!.sub, resourceId: userId });
    res.json({ success: true, correlationId, data: { userId, mustChangePassword: true } });
  });

  // ── PATCH /api/admin/members/:userId/profile ───────────────────────────
  router.patch("/admin/members/:userId/profile", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const { userId } = req.params;
    const { name, email } = req.body as { name?: string; email?: string | null };

    const updated = updateLocalUser(dataDir, userId, { name, email });
    if (!updated) {
      res.status(404).json({ success: false, correlationId, error: "User not found or is not a local account" }); return;
    }
    res.json({ success: true, correlationId, data: { userId, name, email } });
  });

  // ── DELETE /api/admin/members/:userId ──────────────────────────────────
  // Remove from workspace. Pass ?deleteAccount=true to also delete the local user account.
  router.delete("/admin/members/:userId", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const dataDir = DATA_DIR();
    const workspaceId = auth!.tenantId ?? auth!.workspaceId;
    const { userId } = req.params;
    const deleteAccount = req.query.deleteAccount === "true";

    // Prevent removing the workspace owner
    const ws = getWorkspace(dataDir, workspaceId);
    if (ws?.owner_id === userId) {
      res.status(403).json({ success: false, correlationId, error: "Cannot remove the workspace owner" }); return;
    }

    removeWorkspaceMember(dataDir, workspaceId, userId, auth!.sub);

    if (deleteAccount) {
      deleteLocalUser(dataDir, userId);
    }

    logToolEvent({ tool: "admin", action: "member_removed", actorId: auth!.sub, resourceId: userId,
      meta: { workspaceId, deleteAccount } });
    res.json({ success: true, correlationId, data: { userId, removed: true, accountDeleted: deleteAccount } });
  });

  return router;
}
