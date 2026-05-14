// ── Deployment Service ────────────────────────────────────────────────
//
// Handles FormKey deployment from Vault to workspace.
//
import Database from "better-sqlite3";
import { getDb } from "./workspaceStore.js";
import crypto from "node:crypto";

export type DeployedProcess = {
  id: string;
  workspace_id: string;
  form_key: string;
  process_id: string;
  process_version: string;
  deployed_by: string;
  deployed_at: string;
  manifest_hash: string | null;
  status: "active" | "archived" | "error";
};

export type DeploymentInput = {
  workspaceId: string;
  formKey: string;
  processId: string;
  processVersion: string;
  deployedBy: string;
  manifestHash?: string;
};

/**
 * Deploy a process from Vault to a workspace.
 * Creates or updates deployed_processes entry.
 */
export function deployProcess(
  dataDir: string,
  input: DeploymentInput
): DeployedProcess {
  const db = getDb(dataDir);

  // Check if already deployed
  const existing = getDeployedProcess(dataDir, input.workspaceId, input.formKey);
  
  if (existing) {
    // Update existing deployment
    db.prepare(`
      UPDATE deployed_processes
      SET process_id = ?,
          process_version = ?,
          deployed_by = ?,
          deployed_at = datetime('now'),
          manifest_hash = ?,
          status = 'active'
      WHERE id = ?
    `).run(
      input.processId,
      input.processVersion,
      input.deployedBy,
      input.manifestHash || null,
      existing.id
    );
    return getDeployedProcessById(dataDir, existing.id)!;
  }

  // Create new deployment
  const id = `dp-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO deployed_processes (
      id, workspace_id, form_key, process_id, process_version,
      deployed_by, manifest_hash, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    id,
    input.workspaceId,
    input.formKey,
    input.processId,
    input.processVersion,
    input.deployedBy,
    input.manifestHash || null
  );

  return getDeployedProcessById(dataDir, id)!;
}

/**
 * Get deployed process by workspace + formKey.
 */
export function getDeployedProcess(
  dataDir: string,
  workspaceId: string,
  formKey: string
): DeployedProcess | null {
  const db = getDb(dataDir);
  const row = db.prepare(`
    SELECT * FROM deployed_processes
    WHERE workspace_id = ? AND form_key = ?
  `).get(workspaceId, formKey);
  return row ? (row as DeployedProcess) : null;
}

/**
 * Get deployed process by ID.
 */
export function getDeployedProcessById(
  dataDir: string,
  id: string
): DeployedProcess | null {
  const db = getDb(dataDir);
  const row = db.prepare(`
    SELECT * FROM deployed_processes WHERE id = ?
  `).get(id);
  return row ? (row as DeployedProcess) : null;
}

/**
 * List all deployed processes for a workspace.
 */
export function listDeployedProcesses(
  dataDir: string,
  workspaceId: string,
  statusFilter?: "active" | "archived" | "error"
): DeployedProcess[] {
  const db = getDb(dataDir);
  
  let query = `SELECT * FROM deployed_processes WHERE workspace_id = ?`;
  const params: any[] = [workspaceId];
  
  if (statusFilter) {
    query += ` AND status = ?`;
    params.push(statusFilter);
  }
  
  query += ` ORDER BY deployed_at DESC`;
  
  return db.prepare(query).all(...params) as DeployedProcess[];
}

/**
 * Archive (soft delete) a deployed process.
 */
export function archiveDeployedProcess(
  dataDir: string,
  workspaceId: string,
  formKey: string
): boolean {
  const db = getDb(dataDir);
  const result = db.prepare(`
    UPDATE deployed_processes
    SET status = 'archived'
    WHERE workspace_id = ? AND form_key = ? AND status = 'active'
  `).run(workspaceId, formKey);
  
  return result.changes > 0;
}

/**
 * Mark deployment as error state.
 */
export function markDeploymentError(
  dataDir: string,
  deploymentId: string
): boolean {
  const db = getDb(dataDir);
  const result = db.prepare(`
    UPDATE deployed_processes
    SET status = 'error'
    WHERE id = ?
  `).run(deploymentId);
  
  return result.changes > 0;
}
