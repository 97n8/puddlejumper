// ── Chain Template Management Routes ────────────────────────────────────────
//
// CRUD endpoints for approval chain templates (admin-only).
//
//   GET    /api/chain-templates           — list all templates
//   GET    /api/chain-templates/:id       — get a single template
//   POST   /api/chain-templates           — create a new template
//   PUT    /api/chain-templates/:id       — update an existing template
//   DELETE /api/chain-templates/:id       — delete a template
//
import express from "express";
import {
  getAuthContext,
  requireAuthenticated,
} from "@publiclogic/core";
import type { ChainStore } from "../../engine/chainStore.js";
import { DEFAULT_TEMPLATE_ID } from "../../engine/chainStore.js";
import { getCorrelationId } from "../serverMiddleware.js";
import { enforceTierLimit } from "../middleware/enforceTierLimit.js";
import { requireRole } from "../middleware/checkWorkspaceRole.js";
import { incrementTemplateCount, decrementTemplateCount } from "../../engine/workspaceStore.js";

export type ChainTemplateRouteOptions = {
  chainStore: ChainStore;
};

export function createChainTemplateRoutes(opts: ChainTemplateRouteOptions): express.Router {
  const router = express.Router();
  const { chainStore } = opts;

  // ── List templates (workspace-scoped) ────────────────────────────────
  router.get("/chain-templates", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const templates = chainStore.listTemplates({ workspaceId: auth.workspaceId });
    res.json({ success: true, correlationId, data: templates });
  });

  // ── Get single template (workspace-scoped) ───────────────────────────
  router.get("/chain-templates/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    const template = chainStore.getTemplate(req.params.id);
    if (!template || template.workspace_id !== auth.workspaceId) {
      res.status(404).json({ success: false, correlationId, error: "Template not found" });
      return;
    }
    res.json({ success: true, correlationId, data: template });
  });

  // ── Create template (workspace-scoped) ───────────────────────────────
  router.post("/chain-templates", requireAuthenticated(), requireRole("owner", "admin"), enforceTierLimit("template"), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    const { id, name, description, steps } = req.body ?? {};

    if (!auth) { res.status(401).json({ success: false, correlationId, error: "Unauthorized" }); return; }
    if (!name || typeof name !== "string") {
      res.status(400).json({ success: false, correlationId, error: "name is required and must be a string" });
      return;
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ success: false, correlationId, error: "steps must be a non-empty array" });
      return;
    }
    for (const step of steps) {
      if (typeof step.order !== "number" || typeof step.requiredRole !== "string" || typeof step.label !== "string") {
        res.status(400).json({
          success: false, correlationId,
          error: "Each step must have numeric order, string requiredRole, and string label",
        });
        return;
      }
    }
    try {
      const template = chainStore.createTemplate({
        id: typeof id === "string" ? id : undefined,
        name,
        description: typeof description === "string" ? description : undefined,
        steps,
        workspaceId: auth.workspaceId,
      });
      const dataDir = process.env.DATA_DIR || "./data";
      try {
        incrementTemplateCount(dataDir, auth.workspaceId);
      } catch {
        // Workspace doesn't exist - skip counter update (legacy/test behavior)
      }
      res.status(201).json({ success: true, correlationId, data: template });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = message.includes("UNIQUE constraint") ? 409 : 400;
      res.status(status).json({ success: false, correlationId, error: message });
    }
  });

  // ── Update template ───────────────────────────────────────────────────
  router.put("/chain-templates/:id", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const correlationId = getCorrelationId(res);
    const templateId = req.params.id;

    // Protect default template
    if (templateId === DEFAULT_TEMPLATE_ID) {
      res.status(403).json({
        success: false, correlationId,
        error: "The default template cannot be modified",
      });
      return;
    }

    const existing = chainStore.getTemplate(templateId);
    if (!existing) {
      res.status(404).json({ success: false, correlationId, error: "Template not found" });
      return;
    }

    const { name, description, steps } = req.body ?? {};

    if (name !== undefined && (typeof name !== "string" || !name)) {
      res.status(400).json({ success: false, correlationId, error: "name must be a non-empty string" });
      return;
    }

    if (steps !== undefined) {
      if (!Array.isArray(steps) || steps.length === 0) {
        res.status(400).json({ success: false, correlationId, error: "steps must be a non-empty array" });
        return;
      }
      for (const step of steps) {
        if (typeof step.order !== "number" || typeof step.requiredRole !== "string" || typeof step.label !== "string") {
          res.status(400).json({
            success: false, correlationId,
            error: "Each step must have numeric order, string requiredRole, and string label",
          });
          return;
        }
      }
    }

    try {
      const updated = chainStore.updateTemplate(templateId, {
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
        steps: steps ?? undefined,
      });
      res.json({ success: true, correlationId, data: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ success: false, correlationId, error: message });
    }
  });

  // ── Delete template ───────────────────────────────────────────────────
  router.delete("/chain-templates/:id", requireAuthenticated(), requireRole("owner", "admin"), (req, res) => {
    const correlationId = getCorrelationId(res);
    const templateId = req.params.id;
    const auth = getAuthContext(req);

    // Protect default template
    if (templateId === DEFAULT_TEMPLATE_ID) {
      res.status(403).json({
        success: false, correlationId,
        error: "The default template cannot be deleted",
      });
      return;
    }

    const existing = chainStore.getTemplate(templateId);
    if (!existing) {
      res.status(404).json({ success: false, correlationId, error: "Template not found" });
      return;
    }

    // Check if template is in use by active chains (pending/active steps)
    const inUseCount = chainStore.countActiveChainsByTemplate(templateId);
    if (inUseCount > 0) {
      res.status(409).json({
        success: false, correlationId,
        error: `Template is in use by ${inUseCount} active chain(s) and cannot be deleted`,
      });
      return;
    }

    chainStore.deleteTemplate(templateId);
    if (auth) {
      const dataDir = process.env.DATA_DIR || "./data";
      try {
        decrementTemplateCount(dataDir, auth.workspaceId);
      } catch {
        // Workspace doesn't exist - skip counter update (legacy/test behavior)
      }
    }
    res.json({ success: true, correlationId, data: { deleted: true, id: templateId } });
  });

  return router;
}
