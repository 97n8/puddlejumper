import bcrypt from "bcrypt";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  getLastLines,
  excerptText,
  readAuditEntries,
  appendAuditEntry
} from "../src/audit.js";
import {
  listAttachedRepos,
  listRepoFiles,
  resolveRepoFromId,
  resolveRepoFilePath,
  inferEditorMode
} from "../src/repos.js";
import { acquireFileLock, releaseFileLock } from "../src/lock.js";
import { findUserByUsername } from "../src/users.js";
import {
  validateDeploymentContext,
  normalizeDeploymentContext,
  contextFingerprint
} from "../veritas/validation/deployment-context.js";
import { toLegacyDeploymentContext } from "../models/DeploymentContext.js";
import { validateGuardrailAcknowledgments } from "../veritas/validation/guardrails.js";
import { generateGovernanceDiff } from "../veritas/governance-diff/generate.js";
import { loadContextById } from "./contexts.js";
import {
  getDeploymentContext,
  saveDeploymentContext
} from "../veritas/context/store.js";
import {
  appendVeritasMemoryEntry,
  listVeritasMemoryEntries,
  entriesToCsv
} from "../veritas/memory/store.js";
import {
  summarizeTarget,
  defaultReviewConfirmationPhrase
} from "../veritas/target.js";
import {
  canStartDeployment,
  transitionDeploymentPhase,
  resetDeploymentPhaseToIdle
} from "../veritas/state-machine.js";
import {
  assertTrustedDeployScript,
  computeFileSha256
} from "../src/trust.js";

const DIFF_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const HTML_SNAPSHOT_MAX_CHARS = 200_000;
const SCRIPT_JSON_PATTERN =
  /<script[^>]*type=["']application\/(?:json|ld\+json)["'][^>]*>([\s\S]*?)<\/script>/gi;
const NEXT_DATA_PATTERN = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const WINDOW_JSON_PATTERNS = [
  /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/i,
  /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/i,
  /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/i
];
const MIN_DEPLOY_REASON_LENGTH = 8;
const MIN_EMERGENCY_SUMMARY_LENGTH = 20;

function isEmergencyDeclarationActive(emergencyDeclaration) {
  if (!emergencyDeclaration || typeof emergencyDeclaration !== "object") {
    return false;
  }

  const dueAt = Date.parse(String(emergencyDeclaration.postActionReviewDueAt || ""));
  if (Number.isNaN(dueAt)) {
    return false;
  }

  return Date.now() <= dueAt;
}

function veritasMessage(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return "Veritas: Unknown error.";
  }
  if (text.startsWith("Veritas:")) {
    return text;
  }
  return `Veritas: ${text}`;
}

function normalizeLineEndings(text) {
  return String(text || "").replace(/\r\n/g, "\n");
}

function createRecoveryPayload({
  code,
  title,
  summary,
  details,
  nextActions
}) {
  return {
    code: String(code || "veritas_error"),
    title: String(title || "Action Required"),
    summary: String(summary || "An unexpected issue occurred."),
    details: details ? String(details) : "",
    nextActions: Array.isArray(nextActions)
      ? nextActions
      : [
          { id: "retry", label: "Retry" },
          { id: "open_audit", label: "Open Audit" }
        ]
  };
}

function createRunError({
  code,
  title,
  summary,
  details,
  nextActions,
  status = 422
}) {
  const error = new Error(summary);
  error.code = code;
  error.title = title;
  error.summary = summary;
  error.details = details;
  error.nextActions = nextActions;
  error.statusCode = status;
  return error;
}

function toRecoveryPayload(error, fallback) {
  const fallbackPayload = createRecoveryPayload(fallback);
  if (!(error instanceof Error)) {
    return fallbackPayload;
  }

  return createRecoveryPayload({
    code: error.code || fallbackPayload.code,
    title: error.title || fallbackPayload.title,
    summary: error.summary || error.message || fallbackPayload.summary,
    details: error.details || fallbackPayload.details,
    nextActions: error.nextActions || fallbackPayload.nextActions
  });
}

function hashContent(text) {
  return crypto.createHash("sha256").update(normalizeLineEndings(text), "utf8").digest("hex");
}

function parseJsonSafe(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readJsonFromHtml(html) {
  const nextDataMatch = html.match(NEXT_DATA_PATTERN);
  if (nextDataMatch) {
    const parsed = parseJsonSafe(nextDataMatch[1].trim());
    if (parsed) {
      return { source: "next-data-script", json: parsed };
    }
  }

  const scriptMatches = html.matchAll(SCRIPT_JSON_PATTERN);
  for (const match of scriptMatches) {
    const parsed = parseJsonSafe(String(match[1] || "").trim());
    if (parsed) {
      return { source: "json-script-tag", json: parsed };
    }
  }

  for (const pattern of WINDOW_JSON_PATTERNS) {
    const match = html.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = parseJsonSafe(String(match[1] || "").trim());
    if (parsed) {
      return { source: "window-json-state", json: parsed };
    }
  }

  return null;
}

function parsePreviewJson(payloadText) {
  const trimmed = String(payloadText || "").trim();
  if (!trimmed) {
    throw new Error("Preview response body was empty.");
  }

  const directJson = parseJsonSafe(trimmed);
  if (directJson) {
    return { source: "raw-response", json: directJson };
  }

  const htmlPayload = readJsonFromHtml(trimmed);
  if (htmlPayload) {
    return htmlPayload;
  }

  const truncated = trimmed.length > HTML_SNAPSHOT_MAX_CHARS;
  return {
    source: "html-snapshot",
    json: {
      html_snapshot: truncated ? trimmed.slice(0, HTML_SNAPSHOT_MAX_CHARS) : trimmed,
      truncated,
      total_length: trimmed.length
    }
  };
}

function mapPhaseToState(phase) {
  if (phase === "validating" || phase === "deploying") {
    return "running";
  }
  if (phase === "complete") {
    return "complete";
  }
  if (phase === "error") {
    return "error";
  }
  return "idle";
}

function toEditorPayload(content, targetSummary) {
  const editorMode = inferEditorMode(targetSummary.absoluteFilePath, content);
  if (editorMode === "json") {
    try {
      const parsed = JSON.parse(content);
      return {
        editorMode,
        content: `${JSON.stringify(parsed, null, 2)}\n`
      };
    } catch {
      return {
        editorMode: "text",
        content
      };
    }
  }

  return {
    editorMode,
    content
  };
}

function getCurrentTargetSummary(runtime) {
  return summarizeTarget(runtime.activeTarget);
}

function cleanupDiffCache(diffCache) {
  const now = Date.now();
  for (const [diffId, entry] of diffCache.entries()) {
    if (now - entry.createdAt > DIFF_CACHE_MAX_AGE_MS) {
      diffCache.delete(diffId);
    }
  }
}

async function readCurrentTargetContent(runtime) {
  const target = getCurrentTargetSummary(runtime);
  const raw = await fs.readFile(target.absoluteFilePath, "utf8");
  const editor = toEditorPayload(raw, target);

  runtime.activeTarget.editorMode = editor.editorMode;

  return {
    ...editor,
    target,
    requiredConfirmationText: defaultReviewConfirmationPhrase(target)
  };
}

async function applyTargetSelection({ runtime, config, repoId, relativeFilePath, previewUrl }) {
  const repos = await listAttachedRepos({
    repoSearchRoot: config.repoSearchRoot,
    repoAllowList: config.repoAllowList
  });
  const repo = resolveRepoFromId(repos, repoId);
  if (!repo) {
    throw new Error("Selected repository was not found.");
  }

  const resolvedTargetFilePath = resolveRepoFilePath(repo.repoRoot, relativeFilePath);
  if (!resolvedTargetFilePath) {
    throw new Error("Selected target file is outside repository root.");
  }

  runtime.activeTarget.repoId = repo.id;
  runtime.activeTarget.repoName = repo.name;
  runtime.activeTarget.repoRoot = repo.repoRoot;
  runtime.activeTarget.originRemote = repo.originRemote;
  runtime.activeTarget.branch = repo.branch;
  runtime.activeTarget.targetFilePath = resolvedTargetFilePath;
  runtime.activeTarget.previewUrl = previewUrl ? String(previewUrl).trim() : runtime.activeTarget.previewUrl;

  await fs.mkdir(path.dirname(runtime.activeTarget.targetFilePath), { recursive: true });
  try {
    await fs.access(runtime.activeTarget.targetFilePath);
  } catch {
    await fs.writeFile(runtime.activeTarget.targetFilePath, "", "utf8");
  }

  return readCurrentTargetContent(runtime);
}

function buildStatusPayload(runtime) {
  const target = getCurrentTargetSummary(runtime);
  const phase = runtime.deployState.phase;
  const emergencyDeclaration = runtime.deployState.emergencyDeclaration;
  return {
    phase,
    state: mapPhaseToState(phase),
    phaseUpdatedAt: runtime.deployState.phaseUpdatedAt,
    phaseDetail: runtime.deployState.lastPhaseDetail,
    lastDeployTime: runtime.deployState.lastDeployTime,
    lastResult: runtime.deployState.lastResult,
    lastSuccessTime: runtime.deployState.lastSuccessTime,
    lastDeploymentId: runtime.deployState.lastDeploymentId,
    lastDeploymentReason: runtime.deployState.lastDeploymentReason,
    lastCommitSha: runtime.deployState.lastCommitSha,
    lastStdoutExcerpt: runtime.deployState.lastStdoutExcerpt,
    lastStderrExcerpt: runtime.deployState.lastStderrExcerpt,
    lastErrorLines: runtime.deployState.lastErrorLines,
    runningDeployment: runtime.deployState.runningDeployment,
    emergencyDeclaration,
    emergencyDeclarationActive: isEmergencyDeclarationActive(emergencyDeclaration),
    lastEmergencyDeployTime: runtime.deployState.lastEmergencyDeployTime,
    target,
    requiredConfirmationText: defaultReviewConfirmationPhrase(target)
  };
}

function buildMemoryPrompt(deploymentId, context, target, reason) {
  return {
    show: true,
    deploymentId,
    client: context.clientShortName,
    environment: context.environmentType,
    reason: String(reason || ""),
    canonVersion: "v1.0",
    target
  };
}

export function registerApiRoutes(app, deps) {
  const {
    config,
    runtime,
    sessionCookieName,
    loginTracker,
    requireOperatorAuth,
    getGitHeadSha,
    executeDeploymentScript,
    saveDeploymentState
  } = deps;

  async function persistRuntimeState() {
    if (typeof saveDeploymentState !== "function") {
      return;
    }
    await saveDeploymentState(config.deploymentStatePath, runtime.deployState);
  }

  async function transitionAndPersist(phase, detail) {
    transitionDeploymentPhase(runtime.deployState, phase, detail);
    await persistRuntimeState();
  }

  async function resetToIdleAndPersist(detail) {
    resetDeploymentPhaseToIdle(runtime.deployState, detail);
    await persistRuntimeState();
  }

  app.get("/health", (_req, res) => {
    res.json({
      system: config.systemName,
      version: config.appVersion,
      phase: runtime.deployState.phase,
      lastSuccessfulDeployment: runtime.deployState.lastSuccessTime,
      previewUrl: runtime.activeTarget.previewUrl,
      target: getCurrentTargetSummary(runtime)
    });
  });

  app.get("/emergency/status", requireOperatorAuth, (_req, res) => {
    const declaration = runtime.deployState.emergencyDeclaration;
    res.json({
      declaration,
      active: isEmergencyDeclarationActive(declaration)
    });
  });

  app.post("/emergency/declaration", requireOperatorAuth, async (req, res) => {
    const incidentId = String(req.body?.incidentId || "").trim();
    const summary = String(req.body?.summary || "").trim();
    const impactLevel = String(req.body?.impactLevel || "").trim().toLowerCase();
    const approver = String(req.body?.approver || "").trim();
    const checklist = req.body?.compressedReviewChecklist;
    const declaredBy = req.session.user.username;
    const errors = [];

    if (!incidentId) {
      errors.push("Veritas: Incident ID is required.");
    }
    if (summary.length < MIN_EMERGENCY_SUMMARY_LENGTH) {
      errors.push(
        `Veritas: Emergency summary must be at least ${MIN_EMERGENCY_SUMMARY_LENGTH} characters.`
      );
    }
    if (!approver) {
      errors.push("Veritas: Emergency approver is required.");
    }

    const normalizedChecklist = {
      incidentScoped: Boolean(checklist?.incidentScoped),
      rollbackPrepared: Boolean(checklist?.rollbackPrepared),
      commsPrepared: Boolean(checklist?.commsPrepared)
    };

    if (!normalizedChecklist.incidentScoped) {
      errors.push("Veritas: Confirm incident scope before declaring emergency mode.");
    }
    if (!normalizedChecklist.rollbackPrepared) {
      errors.push("Veritas: Confirm rollback preparation before declaring emergency mode.");
    }
    if (!normalizedChecklist.commsPrepared) {
      errors.push("Veritas: Confirm communication plan before declaring emergency mode.");
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: "Veritas: Emergency declaration is incomplete.",
        errors
      });
      return;
    }

    const declaredAt = new Date().toISOString();
    const postActionReviewDueAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const declaration = {
      id: crypto.randomUUID(),
      incidentId,
      summary,
      impactLevel: impactLevel || "sev1",
      declaredBy,
      approver,
      declaredAt,
      postActionReviewDueAt,
      compressedReviewChecklist: normalizedChecklist
    };

    runtime.deployState.emergencyDeclaration = declaration;
    runtime.deployState.lastPhaseDetail =
      "Veritas: Emergency declaration active. Compressed review path enabled with explicit guardrails.";
    await persistRuntimeState();

    const target = getCurrentTargetSummary(runtime);
    const auditEntry = await appendAuditEntry(config.auditLogPath, {
      id: crypto.randomUUID(),
      timestamp: declaredAt,
      operator: declaredBy,
      user: declaredBy,
      reason: `Emergency declaration for ${incidentId}`,
      target_repo: target.repoName,
      target_file: target.relativeFilePath,
      target_branch: target.branch,
      preview_url: target.previewUrl,
      result: "emergency_declared",
      git_commit_sha: await getGitHeadSha(target.repoRoot),
      emergency_declaration: declaration,
      stdout_excerpt: "",
      stderr_excerpt: "",
      content_hash: ""
    });

    res.json({
      saved: true,
      declaration,
      active: true,
      audit: auditEntry
    });
  });

  app.delete("/emergency/declaration", requireOperatorAuth, async (req, res) => {
    const existing = runtime.deployState.emergencyDeclaration;
    runtime.deployState.emergencyDeclaration = null;
    await persistRuntimeState();

    if (existing) {
      const target = getCurrentTargetSummary(runtime);
      await appendAuditEntry(config.auditLogPath, {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        operator: req.session.user.username,
        user: req.session.user.username,
        reason: `Emergency declaration cleared (${existing.incidentId})`,
        target_repo: target.repoName,
        target_file: target.relativeFilePath,
        target_branch: target.branch,
        preview_url: target.previewUrl,
        result: "emergency_cleared",
        git_commit_sha: await getGitHeadSha(target.repoRoot),
        emergency_declaration: existing,
        stdout_excerpt: "",
        stderr_excerpt: "",
        content_hash: ""
      });
    }

    res.json({ cleared: true });
  });

  app.post("/login", async (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || !password) {
      res.status(400).json({ error: "Veritas: Username and password are required." });
      return;
    }

    const lock = loginTracker.checkLock(req, username);
    if (lock.locked) {
      const retryAfterSeconds = Math.ceil((lock.retryInMs || 0) / 1000);
      res.status(429).json({
        error: `Veritas: Too many login attempts. Retry in ${retryAfterSeconds} seconds.`
      });
      return;
    }

    const user = await findUserByUsername(config.usersFilePath, username);
    const valid =
      user?.role === "operator" &&
      typeof user.passwordHash === "string" &&
      (await bcrypt.compare(password, user.passwordHash));

    if (!valid) {
      loginTracker.registerFailure(req, username);
      res.status(401).json({ error: "Veritas: Invalid Operator credentials." });
      return;
    }

    loginTracker.clearFailures(req, username);

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        res.status(500).json({ error: "Veritas: Failed to start authenticated Operator session." });
        return;
      }

      req.session.user = { username: user.username, role: "operator" };
      req.session.save((saveError) => {
        if (saveError) {
          res.status(500).json({ error: "Veritas: Failed to persist Operator session." });
          return;
        }

        res.json({ ok: true, role: "Operator", user: req.session.user });
      });
    });
  });

  app.post("/logout", requireOperatorAuth, (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        res.status(500).json({ error: "Veritas: Failed to end Operator session." });
        return;
      }
      res.clearCookie(sessionCookieName);
      res.json({ ok: true });
    });
  });

  app.get("/repos", requireOperatorAuth, async (req, res) => {
    const query = String(req.query.q || "").trim().toLowerCase();
    const repos = await listAttachedRepos({
      repoSearchRoot: config.repoSearchRoot,
      repoAllowList: config.repoAllowList
    });

    const filtered = repos.filter((repo) => {
      if (!query) {
        return true;
      }
      return (
        repo.name.toLowerCase().includes(query) ||
        String(repo.originRemote || "").toLowerCase().includes(query)
      );
    });

    res.json({
      repos: filtered
    });
  });

  app.get("/repo-files", requireOperatorAuth, async (req, res) => {
    const repoId = String(req.query.repoId || "").trim();
    if (!repoId) {
      res.status(400).json({ error: "Veritas: Query parameter 'repoId' is required." });
      return;
    }

    const repos = await listAttachedRepos({
      repoSearchRoot: config.repoSearchRoot,
      repoAllowList: config.repoAllowList
    });
    const repo = resolveRepoFromId(repos, repoId);
    if (!repo) {
      res.status(404).json({ error: "Veritas: Selected repository was not found." });
      return;
    }

    const query = String(req.query.q || "").trim();
    const files = await listRepoFiles({
      repoRoot: repo.repoRoot,
      query,
      limit: Number(req.query.limit || 300)
    });

    res.json({
      repo,
      files: files.map((item) => ({ relativePath: item.relativePath }))
    });
  });

  app.get("/target", requireOperatorAuth, (_req, res) => {
    const target = getCurrentTargetSummary(runtime);
    res.json({
      target,
      requiredConfirmationText: defaultReviewConfirmationPhrase(target)
    });
  });

  app.post("/target", requireOperatorAuth, async (req, res) => {
    try {
      const repoId = String(req.body?.repoId || "").trim();
      const relativeFilePath = String(req.body?.relativeFilePath || "").trim();
      const previewUrl = String(req.body?.previewUrl || "").trim();
      if (!repoId || !relativeFilePath) {
        res.status(400).json({
          error: "Veritas: Both 'repoId' and 'relativeFilePath' are required."
        });
        return;
      }

      const payload = await applyTargetSelection({
        runtime,
        config,
        repoId,
        relativeFilePath,
        previewUrl
      });

      res.json({
        ok: true,
        ...payload
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      res.status(422).json({ error: veritasMessage(reason) });
    }
  });

  app.get("/deployment-context/:targetId", requireOperatorAuth, async (req, res) => {
    const targetId = String(req.params.targetId || "").trim();
    if (!targetId) {
      res.status(400).json({ error: "Veritas: targetId is required." });
      return;
    }

    const result = await getDeploymentContext(config.deploymentContextPath, targetId);
    res.json({
      targetId,
      context: result?.context || null,
      updatedAt: result?.updatedAt || null
    });
  });

  app.post("/deployment-context", requireOperatorAuth, async (req, res) => {
    const contextValidation = validateDeploymentContext(req.body || {});
    if (!contextValidation.valid) {
      res.status(400).json({ error: "Veritas: Deployment context is invalid.", errors: contextValidation.errors });
      return;
    }

    const target = getCurrentTargetSummary(runtime);
    const saved = await saveDeploymentContext(
      config.deploymentContextPath,
      target.targetId,
      contextValidation.context
    );

    res.json({
      saved: true,
      contextId: target.targetId,
      updatedAt: saved.updatedAt,
      context: saved.context
    });
  });

  app.get("/status", requireOperatorAuth, (_req, res) => {
    res.json(buildStatusPayload(runtime));
  });

  app.get("/content", requireOperatorAuth, async (_req, res) => {
    const payload = await readCurrentTargetContent(runtime);
    res.json(payload);
  });

  app.post("/preview-json", requireOperatorAuth, async (req, res) => {
    const fallbackPreviewUrl = runtime.activeTarget.previewUrl || config.previewUrl;
    const previewUrl = String(req.body?.previewUrl || fallbackPreviewUrl || "").trim();
    if (!previewUrl) {
      res.status(400).json({ error: "Veritas: Preview URL is required." });
      return;
    }

    if (!/^https?:\/\//i.test(previewUrl)) {
      res.status(400).json({ error: "Veritas: Preview URL must start with http:// or https://." });
      return;
    }

    try {
      const response = await fetch(previewUrl, {
        redirect: "follow"
      });
      if (!response.ok) {
        throw new Error(`Preview request failed (${response.status} ${response.statusText}).`);
      }

      const body = await response.text();
      const parsed = parsePreviewJson(body);
      res.json({
        source: parsed.source,
        url: previewUrl,
        json: parsed.json
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      res.status(422).json({
        error: veritasMessage(`Unable to pull JSON from preview URL. ${reason}`)
      });
    }
  });

  app.post("/governance-diff", requireOperatorAuth, async (req, res) => {
    cleanupDiffCache(runtime.diffCache);

    const target = getCurrentTargetSummary(runtime);
    const incomingContent = req.body?.fileContent;
    const selectedContextId = String(req.body?.contextId || "").trim();
    if (typeof incomingContent !== "string") {
      res.status(400).json({ error: "Veritas: fileContent is required to generate Governance Review." });
      return;
    }
    if (!selectedContextId) {
      res.status(400).json({
        error: "Veritas: No deployment context selected. Select a context before Governance Review."
      });
      return;
    }

    const selectedContext = await loadContextById(config.contextsDir, selectedContextId);
    if (!selectedContext) {
      res.status(404).json({
        error: "Veritas: Selected deployment context not found. Reselect a valid context."
      });
      return;
    }

    const contextResult = validateDeploymentContext(toLegacyDeploymentContext(selectedContext));
    if (!contextResult.valid) {
      res.status(400).json({
        error: "Veritas: Deployment context validation failed.",
        errors: contextResult.errors
      });
      return;
    }

    const requestedEmergencyDeclarationId = String(
      req.body?.metadata?.emergencyDeclarationId || ""
    ).trim();
    let emergencyDeclaration = null;
    if (requestedEmergencyDeclarationId) {
      const activeEmergencyDeclaration = runtime.deployState.emergencyDeclaration;
      if (
        !activeEmergencyDeclaration ||
        activeEmergencyDeclaration.id !== requestedEmergencyDeclarationId ||
        !isEmergencyDeclarationActive(activeEmergencyDeclaration)
      ) {
        res.status(400).json({
          error:
            "Veritas: Emergency declaration is missing, expired, or does not match the current declaration."
        });
        return;
      }
      emergencyDeclaration = activeEmergencyDeclaration;
    }

    const existingTargetContent = await fs.readFile(target.absoluteFilePath, "utf8");
    const diff = generateGovernanceDiff({
      context: contextResult.context,
      targetSummary: target,
      existingTargetContent,
      proposedTargetContent: incomingContent,
      emergencyDeclaration
    });

    const diffRecord = {
      diffId: diff.diffId,
      createdAt: Date.now(),
      targetId: target.targetId,
      contextId: selectedContextId,
      contextFingerprint: contextFingerprint(contextResult.context),
      targetContentHash: hashContent(incomingContent),
      guardrails: diff.guardrails,
      contextSnapshot: contextResult.context,
      emergencyDeclarationId: emergencyDeclaration?.id || null
    };

    runtime.diffCache.set(diff.diffId, diffRecord);

    res.json(diff);
  });

  app.get("/audit", requireOperatorAuth, async (req, res) => {
    const requestedLimit = Number(req.query.limit || 50);
    const limit = Number.isNaN(requestedLimit) ? 50 : Math.min(Math.max(requestedLimit, 1), 500);
    const entries = await readAuditEntries(config.auditLogPath);
    const recent = entries.slice(-limit).reverse();
    res.json({ entries: recent });
  });

  app.get("/veritas-memory", requireOperatorAuth, async (req, res) => {
    const clientQuery = String(req.query.client || "").trim();
    const format = String(req.query.format || "json").toLowerCase();
    const entries = await listVeritasMemoryEntries(config.veritasMemoryPath, { clientQuery });

    if (format === "csv") {
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", "attachment; filename=\"veritas-memory.csv\"");
      res.send(entriesToCsv(entries));
      return;
    }

    res.json({ entries });
  });

  app.post("/veritas-memory", requireOperatorAuth, async (req, res) => {
    const notes = String(req.body?.notes || "").trim();
    const deploymentId = String(req.body?.deploymentId || "").trim();
    const contextSnapshot =
      req.body?.contextSnapshot && typeof req.body.contextSnapshot === "object"
        ? normalizeDeploymentContext(req.body.contextSnapshot)
        : null;

    if (!deploymentId) {
      res.status(400).json({ error: "Veritas: deploymentId is required." });
      return;
    }

    if (!notes) {
      res.status(400).json({ error: "Veritas: Notes cannot be empty when saving memory." });
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      client: contextSnapshot?.clientShortName || String(req.body?.client || ""),
      environment: contextSnapshot?.environmentType || String(req.body?.environment || ""),
      reason: String(req.body?.reason || "").trim(),
      canon_version: "v1.0",
      deployment_id: deploymentId,
      operator: req.session.user.username,
      notes,
      context_snapshot: contextSnapshot
    };

    await appendVeritasMemoryEntry(config.veritasMemoryPath, entry);
    res.json({ saved: true, entryId: entry.id });
  });

  app.post("/run", requireOperatorAuth, async (req, res) => {
    const deploymentId = crypto.randomUUID();
    const currentTarget = getCurrentTargetSummary(runtime);
    const operatorUsername = req.session.user.username;
    const runStartedAt = new Date().toISOString();
    const deploymentReason = String(req.body?.reason || "").trim();
    const requestedEmergencyDeclarationId = String(req.body?.emergencyDeclarationId || "").trim();
    const selectedContextId = String(req.body?.contextId || "").trim();

    if (runtime.deployState.phase === "complete" || runtime.deployState.phase === "error") {
      await resetToIdleAndPersist("Veritas: Ready for next deployment.");
    }

    if (!canStartDeployment(runtime.deployState)) {
      const recovery = createRecoveryPayload({
        code: "deployment_in_progress",
        title: "Deployment Already In Progress",
        summary: "Another deployment is currently validating or deploying.",
        details: "Wait for the active deployment to complete, then retry.",
        nextActions: [
          { id: "refresh_status", label: "Refresh Status" },
          { id: "open_audit", label: "Open Audit" }
        ]
      });
      res.status(409).json({
        error: veritasMessage(recovery.summary),
        recovery
      });
      return;
    }

    await transitionAndPersist(
      "validating",
      "Veritas: Validating deployment inputs."
    );
    runtime.deployState.runningDeployment = {
      id: deploymentId,
      operator: operatorUsername,
      startedAt: runStartedAt,
      reason: deploymentReason,
      target: currentTarget
    };
    runtime.deployState.lastDeploymentReason = deploymentReason;
    await persistRuntimeState();

    const lock = await acquireFileLock(config.deployLockPath, config.lockTimeoutMs, {
      id: deploymentId,
      operator: operatorUsername,
      startedAt: runStartedAt
    });

    if (!lock.acquired) {
      await transitionAndPersist(
        "error",
        "Veritas: Deployment lock is active. Another deployment may be in progress."
      );
      runtime.deployState.runningDeployment = null;
      await persistRuntimeState();
      const recovery = createRecoveryPayload({
        code: "deployment_lock_active",
        title: "Deployment Lock Active",
        summary: "A deployment lock is active. Another run may still be in progress.",
        details: "If the lock is stale, wait for timeout and retry deliberately.",
        nextActions: [
          { id: "refresh_status", label: "Refresh Status" },
          { id: "retry", label: "Retry Deployment" }
        ]
      });
      res.status(409).json({
        error: veritasMessage(recovery.summary),
        recovery
      });
      return;
    }

    let result = "error";
    let stdout = "";
    let stderr = "";
    let contextSnapshot = null;
    let guardrailTriggers = [];
    let trustedDeployScriptPath = "";
    let trustedDeployScriptHash = "";
    let emergencyDeclaration = null;
    let selectedContext = null;
    let runFailure = null;

    try {
      if (deploymentReason.length < MIN_DEPLOY_REASON_LENGTH) {
        throw createRunError({
          code: "deploy_reason_required",
          title: "Deploy Reason Required",
          summary: `A deploy reason is required (${MIN_DEPLOY_REASON_LENGTH}+ characters).`,
          details:
            "Describe operator intent before deployment so audit and memory remain defensible.",
          nextActions: [
            { id: "add_reason", label: "Add Deploy Reason" },
            { id: "open_review", label: "Return to Governance Review" }
          ],
          status: 400
        });
      }

      const incomingContent = req.body?.content;
      if (typeof incomingContent !== "string") {
        throw createRunError({
          code: "content_required",
          title: "Deployment Content Missing",
          summary: "Request body must include string field 'content'.",
          details: "Reload the target file and regenerate governance review before deploying.",
          nextActions: [
            { id: "reload_target", label: "Reload Target File" },
            { id: "open_review", label: "Regenerate Governance Review" }
          ]
        });
      }

      if (!selectedContextId) {
        throw createRunError({
          code: "context_selection_required",
          title: "Deployment Context Required",
          summary: "No deployment context selected.",
          details: "Select a municipality/environment context before deployment.",
          nextActions: [
            { id: "select_context", label: "Select Deployment Context" },
            { id: "open_review", label: "Regenerate Governance Review" }
          ],
          status: 400
        });
      }

      selectedContext = await loadContextById(config.contextsDir, selectedContextId);
      if (!selectedContext) {
        throw createRunError({
          code: "context_not_found",
          title: "Deployment Context Not Found",
          summary: "Selected deployment context was not found.",
          details: "Reselect a valid deployment context and retry deliberately.",
          nextActions: [
            { id: "select_context", label: "Select Deployment Context" },
            { id: "open_review", label: "Regenerate Governance Review" }
          ],
          status: 404
        });
      }

      const validation = validateDeploymentContext(toLegacyDeploymentContext(selectedContext));
      if (!validation.valid) {
        throw createRunError({
          code: "context_invalid",
          title: "Deployment Context Invalid",
          summary: "Deployment context failed validation.",
          details: validation.errors.join(" "),
          nextActions: [
            { id: "edit_context", label: "Fix Deployment Context" },
            { id: "save_context", label: "Save Deployment Context" }
          ]
        });
      }
      contextSnapshot = validation.context;

      const diffId = String(req.body?.diffId || "").trim();
      if (!diffId) {
        throw createRunError({
          code: "review_required",
          title: "Governance Review Required",
          summary: "Generate Governance Review before deployment.",
          details: "Run Governance Review for the current target, deployment context, and edited content.",
          nextActions: [
            { id: "open_review", label: "Generate Governance Review" }
          ]
        });
      }

      const diffRecord = runtime.diffCache.get(diffId);
      if (!diffRecord) {
        throw createRunError({
          code: "review_expired",
          title: "Governance Review Expired",
          summary: "Governance Review reference expired or is missing.",
          details: "Generate a fresh Governance Review for the latest content and context.",
          nextActions: [
            { id: "open_review", label: "Regenerate Governance Review" }
          ]
        });
      }

      if (diffRecord.contextId !== selectedContextId) {
        throw createRunError({
          code: "review_context_selection_mismatch",
          title: "Context Selection Changed",
          summary: "Governance review context does not match currently selected deployment context.",
          details: "Regenerate Governance Review for the selected context before deployment.",
          nextActions: [{ id: "open_review", label: "Regenerate Governance Review" }]
        });
      }

      const incomingHash = hashContent(incomingContent);
      if (diffRecord.targetId !== currentTarget.targetId) {
        throw createRunError({
          code: "review_target_mismatch",
          title: "Target Mismatch",
          summary: "Governance Review target does not match the current canonical file.",
          details: "Reload the canonical target and regenerate Governance Review before deployment.",
          nextActions: [
            { id: "reload_target", label: "Reload Target File" },
            { id: "open_review", label: "Regenerate Governance Review" }
          ]
        });
      }
      if (diffRecord.contextFingerprint !== contextFingerprint(contextSnapshot)) {
        throw createRunError({
          code: "review_context_mismatch",
          title: "Context Mismatch",
          summary: "Governance Review context does not match saved deployment context.",
          details: "Save deployment context again and regenerate Governance Review.",
          nextActions: [
            { id: "save_context", label: "Save Deployment Context" },
            { id: "open_review", label: "Regenerate Governance Review" }
          ]
        });
      }
      if (diffRecord.targetContentHash !== incomingHash) {
        throw createRunError({
          code: "content_changed_after_review",
          title: "Content Changed After Review",
          summary: "Target file content changed after governance review.",
          details: "Re-run governance review so guardrails reflect current content.",
          nextActions: [
            { id: "open_review", label: "Regenerate Governance Review" }
          ]
        });
      }

      if (diffRecord.emergencyDeclarationId || requestedEmergencyDeclarationId) {
        if (!diffRecord.emergencyDeclarationId) {
          throw createRunError({
            code: "emergency_review_missing",
            title: "Emergency Review Not Captured",
            summary:
              "Emergency deployment requested, but Governance Review was not generated with emergency declaration.",
            details: "Regenerate Governance Review while emergency declaration is active.",
            nextActions: [{ id: "open_review", label: "Regenerate Governance Review" }]
          });
        }

        if (!requestedEmergencyDeclarationId) {
          throw createRunError({
            code: "emergency_id_required",
            title: "Emergency Declaration Confirmation Missing",
            summary: "Emergency declaration ID is required for this governance review.",
            details: "Retry deployment and include the active emergency declaration.",
            nextActions: [{ id: "open_review", label: "Return to Governance Review" }]
          });
        }

        if (requestedEmergencyDeclarationId !== diffRecord.emergencyDeclarationId) {
          throw createRunError({
            code: "emergency_id_mismatch",
            title: "Emergency Declaration Mismatch",
            summary: "Emergency declaration does not match governance review snapshot.",
            details: "Use the active declaration and regenerate Governance Review.",
            nextActions: [{ id: "open_review", label: "Regenerate Governance Review" }]
          });
        }

        const activeEmergencyDeclaration = runtime.deployState.emergencyDeclaration;
        if (
          !activeEmergencyDeclaration ||
          activeEmergencyDeclaration.id !== requestedEmergencyDeclarationId ||
          !isEmergencyDeclarationActive(activeEmergencyDeclaration)
        ) {
          throw createRunError({
            code: "emergency_declaration_expired",
            title: "Emergency Declaration Expired",
            summary: "Emergency declaration is no longer active.",
            details: "Create a new declaration or continue with standard governance flow.",
            nextActions: [{ id: "open_review", label: "Return to Governance Review" }]
          });
        }

        emergencyDeclaration = activeEmergencyDeclaration;
      }

      const typedClientShortName = String(req.body?.confirmationClientShortName || "").trim();
      const expectedClientShortName = String(selectedContext?.clientShortName || contextSnapshot.clientShortName || "").trim();
      if (typedClientShortName !== expectedClientShortName) {
        throw createRunError({
          code: "confirmation_mismatch",
          title: "Typed Confirmation Mismatch",
          summary: "Confirmation text must match the client short name exactly.",
          details: `Expected '${expectedClientShortName}'.`,
          nextActions: [
            { id: "confirm_again", label: "Re-enter Client Short Name" }
          ]
        });
      }

      guardrailTriggers = diffRecord.guardrails || [];
      const ackValidation = validateGuardrailAcknowledgments({
        guardrails: guardrailTriggers,
        acknowledgments: req.body?.guardrailAcknowledgments
      });
      if (!ackValidation.valid) {
        throw createRunError({
          code: "guardrail_ack_missing",
          title: "Guardrail Acknowledgment Missing",
          summary: "Required guardrail checklist items are not complete.",
          details: ackValidation.errors.join(" "),
          nextActions: [
            { id: "ack_guardrails", label: "Complete Guardrail Checklist" }
          ]
        });
      }

      trustedDeployScriptPath = await assertTrustedDeployScript(
        config.deployScriptPath,
        [config.deployRepoRoot, config.appRoot]
      );
      trustedDeployScriptHash = await computeFileSha256(trustedDeployScriptPath);

      await transitionAndPersist(
        "deploying",
        "Veritas: Applying reviewed deployment to canonical target file."
      );

      await fs.writeFile(currentTarget.absoluteFilePath, normalizeLineEndings(incomingContent), "utf8");
      const execution = await executeDeploymentScript({
        targetFilePath: currentTarget.absoluteFilePath,
        repoRoot: currentTarget.repoRoot
      });
      stdout = execution.stdout || "";
      stderr = execution.stderr || "";
      result = "success";
    } catch (error) {
      runFailure = error;
      stdout = error?.stdout || "";
      stderr =
        error?.stderr ||
        (error instanceof Error ? error.summary || error.message : String(error));
      result = error?.killed ? "timeout" : "error";
    } finally {
      await releaseFileLock(config.deployLockPath);
    }

    const completedAt = new Date().toISOString();
    const commitSha = await getGitHeadSha(currentTarget.repoRoot);
    const auditEntry = {
      id: deploymentId,
      timestamp: completedAt,
      operator: operatorUsername,
      user: operatorUsername,
      context_id: selectedContextId,
      client_name: selectedContext?.clientName || contextSnapshot?.clientFormalName || null,
      deployment_environment:
        selectedContext?.deploymentEnvironment || contextSnapshot?.environmentType || null,
      reason: deploymentReason,
      target_repo: currentTarget.repoName,
      target_file: currentTarget.relativeFilePath,
      target_branch: currentTarget.branch,
      preview_url: currentTarget.previewUrl,
      deploy_script_path: trustedDeployScriptPath || config.deployScriptPath,
      deploy_script_hash: trustedDeployScriptHash || null,
      context_snapshot: contextSnapshot,
      guardrail_triggers: guardrailTriggers.map((item) => item.id),
      confirmation_client_short_name: contextSnapshot?.clientShortName || null,
      emergency_deploy: Boolean(emergencyDeclaration),
      emergency_declaration_id: emergencyDeclaration?.id || null,
      post_action_review_due_at: emergencyDeclaration?.postActionReviewDueAt || null,
      result,
      git_commit_sha: commitSha,
      stdout_excerpt: excerptText(stdout),
      stderr_excerpt: excerptText(stderr),
      content_hash: hashContent(req.body?.content || "")
    };
    const savedAuditEntry = await appendAuditEntry(config.auditLogPath, auditEntry);

    runtime.deployState.lastDeployTime = completedAt;
    runtime.deployState.lastResult = result;
    runtime.deployState.lastDeploymentId = deploymentId;
    runtime.deployState.lastDeploymentReason = deploymentReason;
    runtime.deployState.lastCommitSha = commitSha;
    runtime.deployState.lastStdoutExcerpt = savedAuditEntry?.stdout_excerpt || auditEntry.stdout_excerpt;
    runtime.deployState.lastStderrExcerpt = savedAuditEntry?.stderr_excerpt || auditEntry.stderr_excerpt;
    runtime.deployState.lastErrorLines = getLastLines(stderr, 50);
    runtime.deployState.runningDeployment = null;
    await persistRuntimeState();

    if (result === "success") {
      runtime.deployState.lastSuccessTime = completedAt;
      if (emergencyDeclaration) {
        runtime.deployState.lastEmergencyDeployTime = completedAt;
      }
      await transitionAndPersist(
        "complete",
        "Veritas: Deployment complete. Review memory notes before next deployment."
      );
      res.json({
        ok: true,
        deploymentId,
        result,
        contextUsed: contextSnapshot,
        selectedContext: selectedContext
          ? {
              contextId: selectedContext.contextId,
              clientName: selectedContext.clientName,
              clientShortName: selectedContext.clientShortName,
              deploymentEnvironment: selectedContext.deploymentEnvironment
            }
          : null,
        target: currentTarget,
        memoryPrompt: buildMemoryPrompt(
          deploymentId,
          contextSnapshot,
          currentTarget,
          deploymentReason
        ),
        audit: savedAuditEntry || auditEntry
      });
      return;
    }

    await transitionAndPersist(
      "error",
      "Veritas: Deployment failed. Review stderr and guardrails before retry."
    );

    const recovery = toRecoveryPayload(runFailure, {
      code: result === "timeout" ? "deployment_timeout" : "deployment_failed",
      title: result === "timeout" ? "Deployment Timed Out" : "Deployment Failed",
      summary:
        result === "timeout"
          ? "Deployment timed out while executing the deploy script."
          : "Deployment failed during validation or execution.",
      details: excerptText(stderr, 2000),
      nextActions: [
        { id: "open_audit", label: "Open Audit" },
        { id: "retry", label: "Retry Deployment" }
      ]
    });

    const statusCode =
      typeof runFailure?.statusCode === "number" &&
      runFailure.statusCode >= 400 &&
      runFailure.statusCode < 600
        ? runFailure.statusCode
        : 500;
    res.status(statusCode).json({
      ok: false,
      error: veritasMessage(recovery.summary),
      recovery,
      deploymentId,
      contextUsed: contextSnapshot,
      target: currentTarget,
      audit: savedAuditEntry || auditEntry
    });
  });
}
