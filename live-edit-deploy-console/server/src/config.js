import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { assertTrustedDeployScript } from "./trust.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const APP_ROOT = path.resolve(__dirname, "..", "..");
export const SERVER_ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(APP_ROOT, ".env") });

const DEFAULT_SESSION_IDLE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DEPLOY_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_LOGIN_LIMIT = 5;
const DEFAULT_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function resolveFromApp(candidatePath, fallbackPath) {
  const raw = candidatePath || fallbackPath;
  return path.isAbsolute(raw) ? raw : path.resolve(APP_ROOT, raw);
}

export const config = {
  appRoot: APP_ROOT,
  port: Number(process.env.PORT || 3001),
  previewUrl: process.env.PREVIEW_URL || "https://www.publiclogic.org",
  systemName: "PublicLogic Portal - Tenebrux Veritas",
  sessionSecret:
    process.env.SESSION_SECRET || "change-this-session-secret-in-production",
  sessionIdleMs: DEFAULT_SESSION_IDLE_MS,
  deployTimeoutMs: DEFAULT_DEPLOY_TIMEOUT_MS,
  lockTimeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
  loginLimit: DEFAULT_LOGIN_LIMIT,
  loginWindowMs: DEFAULT_LOGIN_WINDOW_MS,
  deployScriptPath: resolveFromApp(process.env.DEPLOY_SCRIPT_PATH, "./scripts/deploy.sh"),
  deployRepoRoot: resolveFromApp(process.env.DEPLOY_REPO_ROOT, "."),
  targetFilePath: resolveFromApp(process.env.CONTENT_FILE_PATH, "./content/prompt.txt"),
  repoSearchRoot: resolveFromApp(process.env.REPO_SEARCH_ROOT, ".."),
  repoAllowList: String(process.env.REPO_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolveFromApp(item, item)),
  dataDir: resolveFromApp(process.env.DATA_DIR, "./data"),
  appVersion: process.env.APP_VERSION || process.env.npm_package_version || "1.0.0"
};

config.usersFilePath = path.join(config.dataDir, "users.json");
config.sessionsDir = path.join(config.dataDir, "sessions");
config.deployLockPath = path.join(config.dataDir, "deploy.lock");
config.auditLogPath = path.join(config.dataDir, "deploy-log.jsonl");
config.contextsDir = path.join(config.dataDir, "contexts");
config.contextAuditPath = path.join(config.dataDir, "context-audit.jsonl");
config.deploymentContextPath = path.join(config.dataDir, "deployment-context.json");
config.veritasMemoryPath = path.join(config.dataDir, "veritas-memory.jsonl");
config.deploymentStatePath = path.join(config.dataDir, "deployment-state.json");
config.veritasEnvironmentsPath = path.join(config.dataDir, "environments.json");
config.veritasCanonPath = path.join(config.dataDir, "vault-canon.json");
config.veritasDeploymentContextsDir = path.join(config.dataDir, "deployment-contexts");
config.veritasConnectionsDir = path.join(config.dataDir, "connections");

export async function ensureRuntimePaths() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.sessionsDir, { recursive: true });
  await fs.mkdir(config.contextsDir, { recursive: true });
  await fs.mkdir(config.veritasDeploymentContextsDir, { recursive: true });
  await fs.mkdir(config.veritasConnectionsDir, { recursive: true });
  await fs.mkdir(path.dirname(config.targetFilePath), { recursive: true });

  try {
    await fs.access(config.targetFilePath);
  } catch {
    await fs.writeFile(config.targetFilePath, "", "utf8");
  }

  try {
    await fs.access(config.deploymentContextPath);
  } catch {
    await fs.writeFile(config.deploymentContextPath, "{}\n", "utf8");
  }

  try {
    await fs.access(config.veritasMemoryPath);
  } catch {
    await fs.writeFile(config.veritasMemoryPath, "", "utf8");
  }

  try {
    await fs.access(config.contextAuditPath);
  } catch {
    await fs.writeFile(config.contextAuditPath, "", "utf8");
  }

  try {
    await fs.access(config.veritasEnvironmentsPath);
  } catch {
    await fs.writeFile(config.veritasEnvironmentsPath, "[]\n", "utf8");
  }

  try {
    await fs.access(config.veritasCanonPath);
  } catch {
    await fs.writeFile(config.veritasCanonPath, "{\n  \"foundations\": [],\n  \"workspaces\": []\n}\n", "utf8");
  }
}

export async function validateDeployScript() {
  try {
    const trustedPath = await assertTrustedDeployScript(
      config.deployScriptPath,
      [config.deployRepoRoot, config.appRoot]
    );
    config.deployScriptPath = trustedPath;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Deploy script is missing or not executable at '${config.deployScriptPath}'. ${reason}`
    );
  }
}
