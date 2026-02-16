// ── Admin PRR Routes ────────────────────────────────────────────────────
//
// Admin endpoints for PRR management (workspace-scoped, requires auth).
//
import express from "express";
import { getAuthContext, requireAuthenticated } from "@publiclogic/core";
import { getCorrelationId } from "../serverMiddleware.js";
import {
  listPRRs,
  getPRRById,
  updatePRR,
  addPRRComment,
  listPRRComments,
  deletePRR,
  PRRFilters,
} from "../../engine/prrStore.js";

export function createAdminPRRRoutes(opts?: { dataDir?: string }): express.Router {
  const router = express.Router();
  
  // GET /api/prr - List PRRs for workspace
  router.get("/api/prr", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    
    // Admin or owner can view PRRs
    if (!auth.role || !["admin", "owner", "member"].includes(auth.role)) {
      res.status(403).json({ success: false, correlationId, error: "Access denied" });
      return;
    }
    
    const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
    
    // Parse filters from query
    const filters: PRRFilters = {
      status: req.query.status as any,
      assigned_to: req.query.assigned_to as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      per_page: req.query.per_page ? parseInt(req.query.per_page as string) : undefined,
    };
    
    try {
      const result = listPRRs(dataDir, auth.workspaceId, filters);
      
      res.json({
        success: true,
        correlationId,
        data: {
          requests: result.requests,
          total: result.total,
          page: filters.page || 1,
          per_page: filters.per_page || 50
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to list PRRs"
      });
    }
  });
  
  // GET /api/prr/:id - Get full PRR details with comments
  router.get("/api/prr/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    
    const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
    const { id } = req.params;
    
    try {
      const prr = getPRRById(dataDir, id);
      
      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }
      
      // Verify workspace access
      if (prr.workspace_id !== auth.workspaceId) {
        res.status(403).json({ success: false, correlationId, error: "Access denied" });
        return;
      }
      
      const comments = listPRRComments(dataDir, id);
      
      res.json({
        success: true,
        correlationId,
        data: {
          ...prr,
          attachments: prr.attachments ? JSON.parse(prr.attachments) : [],
          comments
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to retrieve PRR"
      });
    }
  });
  
  // POST /api/prr/:id/comment - Add comment to PRR
  router.post("/api/prr/:id/comment", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    
    // Only admin/owner can comment
    if (!auth.role || !["admin", "owner"].includes(auth.role)) {
      res.status(403).json({ success: false, correlationId, error: "Admin only" });
      return;
    }
    
    const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
    const { id } = req.params;
    const { body } = req.body;
    
    if (!body || body.trim().length === 0) {
      res.status(400).json({ success: false, correlationId, error: "Comment body required" });
      return;
    }
    
    try {
      // Verify PRR exists and is in workspace
      const prr = getPRRById(dataDir, id);
      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }
      
      if (prr.workspace_id !== auth.workspaceId) {
        res.status(403).json({ success: false, correlationId, error: "Access denied" });
        return;
      }
      
      const comment = addPRRComment(dataDir, id, auth.userId, body);
      
      res.json({ success: true, correlationId, data: comment });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to add comment"
      });
    }
  });
  
  // PATCH /api/prr/:id - Update PRR status/assignment
  router.patch("/api/prr/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    
    // Only admin/owner can update
    if (!auth.role || !["admin", "owner"].includes(auth.role)) {
      res.status(403).json({ success: false, correlationId, error: "Admin only" });
      return;
    }
    
    const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
    const { id } = req.params;
    const { status, assigned_to } = req.body;
    
    try {
      // Verify PRR exists and is in workspace
      const prr = getPRRById(dataDir, id);
      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }
      
      if (prr.workspace_id !== auth.workspaceId) {
        res.status(403).json({ success: false, correlationId, error: "Access denied" });
        return;
      }
      
      const updated = updatePRR(dataDir, id, { status, assigned_to });
      
      res.json({ success: true, correlationId, data: updated });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to update PRR"
      });
    }
  });
  
  // DELETE /api/prr/:id - Delete PRR (admin only, rare)
  router.delete("/api/prr/:id", requireAuthenticated(), (req, res) => {
    const auth = getAuthContext(req);
    const correlationId = getCorrelationId(res);
    
    if (!auth) {
      res.status(401).json({ success: false, correlationId, error: "Unauthorized" });
      return;
    }
    
    // Only owner can delete
    if (!auth.role || auth.role !== "owner") {
      res.status(403).json({ success: false, correlationId, error: "Owner only" });
      return;
    }
    
    const dataDir = opts?.dataDir ?? process.env.DATA_DIR ?? "./data";
    const { id } = req.params;
    
    try {
      // Verify PRR exists and is in workspace
      const prr = getPRRById(dataDir, id);
      if (!prr) {
        res.status(404).json({ success: false, correlationId, error: "PRR not found" });
        return;
      }
      
      if (prr.workspace_id !== auth.workspaceId) {
        res.status(403).json({ success: false, correlationId, error: "Access denied" });
        return;
      }
      
      const deleted = deletePRR(dataDir, id);
      
      if (deleted) {
        res.json({ success: true, correlationId, data: { deleted: true } });
      } else {
        res.status(500).json({ success: false, correlationId, error: "Delete failed" });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to delete PRR"
      });
    }
  });
  
  return router;
}
