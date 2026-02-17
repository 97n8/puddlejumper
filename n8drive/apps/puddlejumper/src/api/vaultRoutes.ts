// ── Vault Routes ──────────────────────────────────────────────────────────────
//
// API routes for FormKey deployment from Vault.
//
import express from "express";
import type { Router } from "express";
import { getAuthContext, createJwtAuthenticationMiddleware } from "@publiclogic/core";
import { getWorkspace } from "../engine/workspaceStore.js";
import {
  deployProcess,
  listDeployedProcesses,
  archiveDeployedProcess,
  getDeployedProcess,
} from "../engine/deploymentService.js";

type VaultRoutesOptions = {
  dataDir: string;
  vaultUrl?: string; // Optional: Vault service URL for fetching process details
};

export function createVaultRoutes(opts: VaultRoutesOptions): Router {
  const router = express.Router();
  const authMiddleware = createJwtAuthenticationMiddleware();

  // POST /api/vault/formkey/:key/deploy
  // Deploy a FormKey to current workspace
  router.post("/vault/formkey/:key/deploy", authMiddleware, async (req, res) => {
    try {
      const formKey = req.params.key;
      const auth = getAuthContext(req);
      
      if (!auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const workspaceId = req.body.workspaceId || auth.tenantId;
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID required" });
      }

      // Verify workspace exists and user has access
      const workspace = getWorkspace(opts.dataDir, workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }

      // Fetch process from Vault (if URL provided) or use local data
      let processId: string;
      let processVersion: string;
      let manifestHash: string | undefined;

      if (opts.vaultUrl) {
        // Fetch from Vault service
        const vaultRes = await fetch(`${opts.vaultUrl}/api/v1/vault/formkey/${formKey}`, {
          headers: {
            Authorization: `Bearer ${req.headers.authorization?.replace("Bearer ", "")}`,
          },
        });

        if (!vaultRes.ok) {
          return res.status(vaultRes.status).json({
            error: `Failed to fetch process from Vault: ${vaultRes.statusText}`,
          });
        }

        const processPackage = await vaultRes.json();
        processId = processPackage.id;
        processVersion = processPackage.version;
        manifestHash = processPackage.manifest?.planHash;
      } else {
        // For now, derive from formKey (local deployment)
        processId = formKey.replace(/-v\d+$/, "");
        processVersion = formKey.match(/-v(\d+)$/)?.[1] || "1";
      }

      // Deploy to workspace
      const deployment = deployProcess(opts.dataDir, {
        workspaceId,
        formKey,
        processId,
        processVersion,
        deployedBy: auth.userId,
        manifestHash,
      });

      return res.json(deployment);
    } catch (error) {
      console.error("[vault/deploy] Error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Deployment failed",
      });
    }
  });

  // GET /api/vault/deployed-processes
  // List deployed processes for workspace
  router.get("/vault/deployed-processes", authMiddleware, (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const workspaceId = (req.query.workspaceId as string) || auth.tenantId;
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID required" });
      }

      const statusFilter = req.query.status as "active" | "archived" | "error" | undefined;
      const deployments = listDeployedProcesses(opts.dataDir, workspaceId, statusFilter);

      return res.json(deployments);
    } catch (error) {
      console.error("[vault/list] Error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to list deployments",
      });
    }
  });

  // GET /api/vault/deployed-processes/:formKey
  // Get specific deployed process
  router.get("/vault/deployed-processes/:formKey", authMiddleware, (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const workspaceId = (req.query.workspaceId as string) || auth.tenantId;
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID required" });
      }

      const formKey = req.params.formKey;
      const deployment = getDeployedProcess(opts.dataDir, workspaceId, formKey);

      if (!deployment) {
        return res.status(404).json({ error: "Deployment not found" });
      }

      return res.json(deployment);
    } catch (error) {
      console.error("[vault/get] Error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to fetch deployment",
      });
    }
  });

  // DELETE /api/vault/deployed-processes/:formKey
  // Archive a deployed process
  router.delete("/vault/deployed-processes/:formKey", authMiddleware, (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const workspaceId = (req.query.workspaceId as string) || auth.tenantId;
      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID required" });
      }

      const formKey = req.params.formKey;
      const archived = archiveDeployedProcess(opts.dataDir, workspaceId, formKey);

      if (!archived) {
        return res.status(404).json({ error: "Deployment not found or already archived" });
      }

      return res.json({ success: true, message: "Deployment archived" });
    } catch (error) {
      console.error("[vault/archive] Error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to archive deployment",
      });
    }
  });

  return router;
}
