// ── CaseSpaces Routes ────────────────────────────────────────────────────
//
// Server-side storage for CaseSpaces so data is consistent across all
// browsers and shared between workspace members.
//
//   GET  /api/v1/casespaces          - list casespaces for the user's workspace
//   POST /api/v1/casespaces          - create a new casespace
//   PUT  /api/v1/casespaces/:id      - update a casespace (owner or admin only)
//   DELETE /api/v1/casespaces/:id    - delete a casespace (owner or admin only)
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import {
  listCaseSpaces,
  createCaseSpace,
  getCaseSpace,
  updateCaseSpace,
  deleteCaseSpace,
  getMemberRole,
  getWorkspace,
  getWorkspaceForMember,
} from "../../engine/workspaceStore.js";

export function createCaseSpacesRoutes(): express.Router {
  const router = express.Router();
  const dataDir = process.env.DATA_DIR || "./data";

  // Resolve workspaceId + role for the authenticated user.
  // If JWT has no tenantId/workspaceId (common for invited members), fall back to
  // looking up which workspace they were added to via the workspace_members table.
  function resolveContext(req: express.Request) {
    const auth = getAuthContext(req);
    if (!auth) return null;
    const rawId = auth.workspaceId ?? auth.tenantId ?? auth.sub;
    let workspaceId = rawId?.startsWith('ws-') ? rawId : `ws-${rawId}`;
    let role = getMemberRole(dataDir, workspaceId, auth.sub);
    if (!role) {
      const ws = getWorkspace(dataDir, workspaceId);
      if (ws && ws.owner_id === auth.sub) {
        role = "owner";
      } else if (auth.role === "admin") {
        role = "owner";
      } else {
        // JWT had no tenantId — look up membership table as fallback
        const membership = getWorkspaceForMember(dataDir, auth.sub);
        if (membership) {
          workspaceId = membership.workspaceId;
          role = membership.role;
        }
      }
    }
    return { auth, workspaceId, role };
  }

  // GET /api/v1/casespaces
  router.get("/v1/casespaces", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const ctx = resolveContext(req);
    if (!ctx) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const spaces = listCaseSpaces(dataDir, ctx.workspaceId, ctx.auth.sub);
    res.json({ success: true, correlationId, casespaces: spaces });
  });

  // POST /api/v1/casespaces
  router.post("/v1/casespaces", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const ctx = resolveContext(req);
    if (!ctx) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    if (!ctx.role) { res.status(403).json({ success: false, correlationId, error: "Not a workspace member" }); return; }

    const { id, name, description, color, icon, type, town, vaultModuleIds, visibility, members, connectionIds, auditEnabled, retentionEnabled, createdAt } = req.body;
    if (!id || !name) { res.status(400).json({ success: false, correlationId, error: "id and name required" }); return; }
    if (name.length > 200) { res.status(400).json({ success: false, correlationId, error: "name too long" }); return; }

    const cs = createCaseSpace(dataDir, {
      id,
      workspace_id: ctx.workspaceId,
      owner_id: ctx.auth.sub,
      name,
      description,
      color,
      icon,
      type: type ?? 'custom',
      town,
      vault_module_ids: vaultModuleIds ?? [],
      visibility: visibility ?? 'organization',
      members: members ?? [],
      connection_ids: connectionIds ?? [],
      audit_enabled: Boolean(auditEnabled),
      retention_enabled: Boolean(retentionEnabled),
      created_at: createdAt ?? Date.now(),
      last_accessed: Date.now(),
    });
    res.status(201).json({ success: true, correlationId, casespace: cs });
  });

  // PUT /api/v1/casespaces/:id
  router.put("/v1/casespaces/:id", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const ctx = resolveContext(req);
    if (!ctx) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const existing = getCaseSpace(dataDir, req.params.id);
    if (!existing) { res.status(404).json({ success: false, correlationId, error: "Not found" }); return; }
    if (existing.workspace_id !== ctx.workspaceId) { res.status(403).json({ success: false, correlationId, error: "Forbidden" }); return; }

    // Only owner, admin, or casespace creator can edit
    const canEdit = ctx.role === "owner" || ctx.role === "admin" || existing.owner_id === ctx.auth.sub;
    if (!canEdit) { res.status(403).json({ success: false, correlationId, error: "Insufficient permissions" }); return; }

    const { name, description, color, icon, type, town, vaultModuleIds, visibility, members, connectionIds, auditEnabled, retentionEnabled, lastAccessed, fileCount, folderCount, templateCount } = req.body;
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    if (type !== undefined) updates.type = type;
    if (town !== undefined) updates.town = town;
    if (vaultModuleIds !== undefined) updates.vault_module_ids = vaultModuleIds;
    if (visibility !== undefined) updates.visibility = visibility;
    if (members !== undefined) updates.members = members;
    if (connectionIds !== undefined) updates.connection_ids = connectionIds;
    if (auditEnabled !== undefined) updates.audit_enabled = Boolean(auditEnabled);
    if (retentionEnabled !== undefined) updates.retention_enabled = Boolean(retentionEnabled);
    if (lastAccessed !== undefined) updates.last_accessed = lastAccessed;
    if (fileCount !== undefined) updates.file_count = fileCount;
    if (folderCount !== undefined) updates.folder_count = folderCount;
    if (templateCount !== undefined) updates.template_count = templateCount;

    const updated = updateCaseSpace(dataDir, req.params.id, updates);
    res.json({ success: true, correlationId, casespace: updated });
  });

  // DELETE /api/v1/casespaces/:id
  router.delete("/v1/casespaces/:id", requireAuthenticated(), (req, res) => {
    const correlationId = getCorrelationId(res);
    const ctx = resolveContext(req);
    if (!ctx) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }

    const existing = getCaseSpace(dataDir, req.params.id);
    if (!existing) { res.status(404).json({ success: false, correlationId, error: "Not found" }); return; }
    if (existing.workspace_id !== ctx.workspaceId) { res.status(403).json({ success: false, correlationId, error: "Forbidden" }); return; }

    const canDelete = ctx.role === "owner" || ctx.role === "admin" || existing.owner_id === ctx.auth.sub;
    if (!canDelete) { res.status(403).json({ success: false, correlationId, error: "Insufficient permissions" }); return; }

    deleteCaseSpace(dataDir, req.params.id);
    res.json({ success: true, correlationId });
  });

  return router;
}
