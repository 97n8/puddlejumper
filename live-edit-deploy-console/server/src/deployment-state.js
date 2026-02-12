import fs from "node:fs/promises";
import path from "node:path";

const STATE_FILE_VERSION = 1;

function sanitizePhase(phase) {
  const allowed = new Set(["idle", "validating", "deploying", "complete", "error"]);
  const candidate = String(phase || "").trim();
  return allowed.has(candidate) ? candidate : "idle";
}

function sanitizeString(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function sanitizeIsoString(value, fallback = null) {
  if (!value) {
    return fallback;
  }
  const parsed = Date.parse(String(value));
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return new Date(parsed).toISOString();
}

function sanitizeLastErrorLines(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((line) => String(line));
}

function sanitizeRunningDeployment(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const target = value.target && typeof value.target === "object" ? value.target : null;
  return {
    id: sanitizeString(value.id, ""),
    operator: sanitizeString(value.operator, ""),
    startedAt: sanitizeIsoString(value.startedAt, null),
    reason: sanitizeString(value.reason, ""),
    target
  };
}

function sanitizeEmergencyDeclaration(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const checklist =
    value.compressedReviewChecklist && typeof value.compressedReviewChecklist === "object"
      ? {
          incidentScoped: Boolean(value.compressedReviewChecklist.incidentScoped),
          rollbackPrepared: Boolean(value.compressedReviewChecklist.rollbackPrepared),
          commsPrepared: Boolean(value.compressedReviewChecklist.commsPrepared)
        }
      : null;

  return {
    id: sanitizeString(value.id, ""),
    incidentId: sanitizeString(value.incidentId, ""),
    summary: sanitizeString(value.summary, ""),
    impactLevel: sanitizeString(value.impactLevel, ""),
    declaredBy: sanitizeString(value.declaredBy, ""),
    approver: sanitizeString(value.approver, ""),
    declaredAt: sanitizeIsoString(value.declaredAt, null),
    postActionReviewDueAt: sanitizeIsoString(value.postActionReviewDueAt, null),
    compressedReviewChecklist: checklist
  };
}

export function sanitizeDeploymentState(rawState) {
  const source = rawState && typeof rawState === "object" ? rawState : {};
  return {
    phase: sanitizePhase(source.phase),
    phaseUpdatedAt: sanitizeIsoString(source.phaseUpdatedAt, new Date().toISOString()),
    lastPhaseDetail: sanitizeString(source.lastPhaseDetail, "Initialized."),
    lastDeployTime: sanitizeIsoString(source.lastDeployTime, null),
    lastResult: sanitizeString(source.lastResult, ""),
    lastSuccessTime: sanitizeIsoString(source.lastSuccessTime, null),
    lastDeploymentId: sanitizeString(source.lastDeploymentId, ""),
    lastCommitSha: sanitizeString(source.lastCommitSha, ""),
    lastStdoutExcerpt: sanitizeString(source.lastStdoutExcerpt, ""),
    lastStderrExcerpt: sanitizeString(source.lastStderrExcerpt, ""),
    lastErrorLines: sanitizeLastErrorLines(source.lastErrorLines),
    lastDeploymentReason: sanitizeString(source.lastDeploymentReason, ""),
    runningDeployment: sanitizeRunningDeployment(source.runningDeployment),
    emergencyDeclaration: sanitizeEmergencyDeclaration(source.emergencyDeclaration),
    lastEmergencyDeployTime: sanitizeIsoString(source.lastEmergencyDeployTime, null)
  };
}

export async function loadDeploymentState(stateFilePath) {
  try {
    const raw = await fs.readFile(stateFilePath, "utf8");
    const parsed = JSON.parse(raw);
    const maybeState =
      parsed && typeof parsed === "object" && parsed.deployState && typeof parsed.deployState === "object"
        ? parsed.deployState
        : parsed;
    return sanitizeDeploymentState(maybeState);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveDeploymentState(stateFilePath, state) {
  const sanitized = sanitizeDeploymentState(state);
  const payload = {
    version: STATE_FILE_VERSION,
    savedAt: new Date().toISOString(),
    deployState: sanitized
  };

  await fs.mkdir(path.dirname(stateFilePath), { recursive: true });
  const tmpFilePath = `${stateFilePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFilePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await fs.rename(tmpFilePath, stateFilePath);
  return sanitized;
}
