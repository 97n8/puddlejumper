import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

import {
  normalizeContext,
  validateContext,
  generateContextId
} from "../models/DeploymentContext.js";

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function listContextFileNames(contextsDir) {
  await ensureDirectory(contextsDir);
  const files = await fs.readdir(contextsDir);
  return files.filter((name) => name.endsWith(".json") && !name.endsWith(".archived.json"));
}

async function readContextFile(contextsDir, contextId) {
  const filePath = path.join(contextsDir, `${contextId}.json`);
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeContextFile(contextsDir, contextId, context) {
  const filePath = path.join(contextsDir, `${contextId}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(context, null, 2)}\n`, "utf8");
  return filePath;
}

async function contextFileExists(contextsDir, contextId) {
  try {
    await fs.access(path.join(contextsDir, `${contextId}.json`));
    return true;
  } catch {
    return false;
  }
}

async function recordContextAudit(contextAuditPath, event) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    ...event
  };
  await fs.appendFile(contextAuditPath, `${JSON.stringify(auditEntry)}\n`, "utf8");
}

function getChangedFields(oldContext, newContext) {
  const changes = {};
  const ignored = new Set(["lastModified", "modifiedBy", "version"]);

  for (const key of Object.keys(newContext)) {
    if (ignored.has(key)) {
      continue;
    }

    if (JSON.stringify(oldContext[key]) !== JSON.stringify(newContext[key])) {
      changes[key] = {
        old: oldContext[key],
        new: newContext[key]
      };
    }
  }

  return changes;
}

export function createContextsRouter({
  contextsDir,
  contextAuditPath,
  requireOperatorAuth
}) {
  const router = express.Router();

  router.get("/contexts", requireOperatorAuth, async (_req, res) => {
    try {
      const fileNames = await listContextFileNames(contextsDir);
      const contexts = [];

      for (const fileName of fileNames) {
        const filePath = path.join(contextsDir, fileName);
        const raw = await fs.readFile(filePath, "utf8");
        const parsed = JSON.parse(raw);
        contexts.push(parsed);
      }

      contexts.sort((left, right) => {
        const leftTime = Date.parse(left.lastModified || left.createdAt || 0);
        const rightTime = Date.parse(right.lastModified || right.createdAt || 0);
        return rightTime - leftTime;
      });

      res.status(200).json({
        contexts,
        total: contexts.length
      });
    } catch (error) {
      console.error("Veritas: Error listing contexts", error);
      res.status(500).json({ error: "Veritas: Failed to list contexts." });
    }
  });

  router.get("/contexts/:contextId", requireOperatorAuth, async (req, res) => {
    try {
      const contextId = String(req.params.contextId || "").trim();
      if (!contextId) {
        res.status(400).json({ error: "Veritas: contextId is required." });
        return;
      }

      const exists = await contextFileExists(contextsDir, contextId);
      if (!exists) {
        res.status(404).json({ error: "Veritas: Context not found." });
        return;
      }

      const context = await readContextFile(contextsDir, contextId);
      res.status(200).json(context);
    } catch (error) {
      console.error("Veritas: Error loading context", error);
      res.status(500).json({ error: "Veritas: Failed to load context." });
    }
  });

  router.post("/contexts", requireOperatorAuth, async (req, res) => {
    try {
      const clientName = String(req.body?.clientName || "").trim();
      const environment = String(req.body?.deploymentEnvironment || "").trim();
      const contextId = generateContextId(clientName, environment);
      const now = new Date().toISOString();
      const operator = req.session.user.username;

      const context = normalizeContext(
        {
          ...req.body,
          contextId,
          createdAt: now,
          createdBy: operator,
          lastModified: now,
          modifiedBy: operator,
          version: 1
        },
        { contextId, operator }
      );

      const errors = validateContext(context);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }

      if (await contextFileExists(contextsDir, contextId)) {
        res.status(409).json({
          error: "Veritas: Context already exists for this client and environment."
        });
        return;
      }

      await writeContextFile(contextsDir, contextId, context);
      await recordContextAudit(contextAuditPath, {
        action: "context_created",
        contextId,
        operator,
        details: {
          clientName: context.clientName,
          environment: context.deploymentEnvironment
        }
      });

      res.status(201).json({
        contextId,
        context,
        message: "Context created successfully"
      });
    } catch (error) {
      console.error("Veritas: Error creating context", error);
      res.status(500).json({ error: "Veritas: Failed to create context." });
    }
  });

  router.put("/contexts/:contextId", requireOperatorAuth, async (req, res) => {
    try {
      const contextId = String(req.params.contextId || "").trim();
      if (!contextId) {
        res.status(400).json({ error: "Veritas: contextId is required." });
        return;
      }

      const exists = await contextFileExists(contextsDir, contextId);
      if (!exists) {
        res.status(404).json({ error: "Veritas: Context not found." });
        return;
      }

      const existing = await readContextFile(contextsDir, contextId);
      const operator = req.session.user.username;
      const now = new Date().toISOString();

      const updated = normalizeContext(
        {
          ...existing,
          ...req.body,
          contextId: existing.contextId,
          createdAt: existing.createdAt,
          createdBy: existing.createdBy,
          lastModified: now,
          modifiedBy: operator,
          version: Number(existing.version || 1) + 1
        },
        { contextId: existing.contextId, operator }
      );

      const errors = validateContext(updated);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }

      await writeContextFile(contextsDir, contextId, updated);
      await recordContextAudit(contextAuditPath, {
        action: "context_updated",
        contextId: updated.contextId,
        operator,
        changes: getChangedFields(existing, updated)
      });

      res.status(200).json({
        contextId: updated.contextId,
        context: updated,
        message: "Context updated successfully"
      });
    } catch (error) {
      console.error("Veritas: Error updating context", error);
      res.status(500).json({ error: "Veritas: Failed to update context." });
    }
  });

  router.delete("/contexts/:contextId", requireOperatorAuth, async (req, res) => {
    try {
      const contextId = String(req.params.contextId || "").trim();
      if (!contextId) {
        res.status(400).json({ error: "Veritas: contextId is required." });
        return;
      }

      const sourcePath = path.join(contextsDir, `${contextId}.json`);
      const exists = await contextFileExists(contextsDir, contextId);
      if (!exists) {
        res.status(404).json({ error: "Veritas: Context not found." });
        return;
      }

      const archivedPath = path.join(contextsDir, `${contextId}.archived.json`);
      await fs.rename(sourcePath, archivedPath);

      await recordContextAudit(contextAuditPath, {
        action: "context_archived",
        contextId,
        operator: req.session.user.username,
        details: {
          archivedPath
        }
      });

      res.status(200).json({
        contextId,
        archived: true,
        message: "Context archived successfully"
      });
    } catch (error) {
      console.error("Veritas: Error archiving context", error);
      res.status(500).json({ error: "Veritas: Failed to archive context." });
    }
  });

  return router;
}

export async function loadContextById(contextsDir, contextId) {
  const cleanId = String(contextId || "").trim();
  if (!cleanId) {
    return null;
  }

  const exists = await contextFileExists(contextsDir, cleanId);
  if (!exists) {
    return null;
  }

  return readContextFile(contextsDir, cleanId);
}
