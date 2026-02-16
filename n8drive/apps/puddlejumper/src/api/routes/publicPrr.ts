// ── Public PRR Routes ──────────────────────────────────────────────────
//
// Public-facing endpoints for PRR submission and status check (no auth).
//
import express from "express";
import { getCorrelationId } from "../serverMiddleware.js";
import { createPRR, getPRRByToken, listPRRComments } from "../../engine/prrStore.js";

type PublicPRRRouteOptions = { dataDir?: string; };

export function createPublicPRRRoutes(opts: PublicPRRRouteOptions = {}): express.Router {
  const router = express.Router();
  
  // POST /public/prr - Submit a new PRR (public, no auth)
  router.post("/public/prr", (req, res) => {
    const correlationId = getCorrelationId(res);
    const dataDir = opts.dataDir || process.env.DATA_DIR || "./data";
    
    const { workspace_id, name, email, summary, details, attachments } = req.body;
    
    // Validation
    if (!summary || summary.trim().length === 0) {
      res.status(400).json({
        success: false,
        correlationId,
        error: "Summary is required"
      });
      return;
    }
    
    if (!workspace_id) {
      res.status(400).json({
        success: false,
        correlationId,
        error: "Workspace ID is required"
      });
      return;
    }
    
    try {
      const prr = createPRR(dataDir, {
        workspace_id,
        name,
        email,
        summary,
        details,
        attachments
      });
      
      res.status(201).json({
        success: true,
        correlationId,
        data: {
          id: prr.id,
          public_token: prr.public_token,
          status: prr.status,
          created_at: prr.created_at
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        correlationId,
        error: error.message || "Failed to create PRR"
      });
    }
  });
  
  // GET /public/prr/:token - Check PRR status (public, no auth)
  router.get("/public/prr/:token", (req, res) => {
    const correlationId = getCorrelationId(res);
    const dataDir = opts.dataDir || process.env.DATA_DIR || "./data";
    const { token } = req.params;
    
    try {
      const prr = getPRRByToken(dataDir, token);
      
      if (!prr) {
        res.status(404).json({
          success: false,
          correlationId,
          error: "PRR not found"
        });
        return;
      }
      
      // Get comments (optionally filter for public comments only)
      const allComments = listPRRComments(dataDir, prr.id);
      
      // For V1, show all comments. In future could filter by visibility flag
      const comments = allComments.map(c => ({
        body: c.body,
        created_at: c.created_at,
        is_admin: !!c.user_id
      }));
      
      res.json({
        success: true,
        correlationId,
        data: {
          summary: prr.summary,
          details: prr.details,
          status: prr.status,
          created_at: prr.created_at,
          updated_at: prr.updated_at,
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
  
  return router;
}
