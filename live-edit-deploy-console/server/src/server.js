import { exec as execCallback } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import express from "express";
import session from "express-session";
import sessionFileStoreFactory from "session-file-store";

import { config, ensureRuntimePaths, validateDeployScript } from "./config.js";
import { assertAtLeastOneOperator } from "./users.js";
import {
  loadDeploymentState,
  saveDeploymentState
} from "./deployment-state.js";
import {
  listAttachedRepos,
  resolveRepoFilePath
} from "./repos.js";
import { createLoginTracker, requireOperatorAuth } from "../auth/operator-auth.js";
import { createDeploymentStateMachine } from "../veritas/state-machine.js";
import { registerApiRoutes } from "../routes/api.js";
import { createContextsRouter } from "../routes/contexts.js";
import { createVeritasRouter } from "../routes/veritas.js";

const FileStore = sessionFileStoreFactory(session);
const SESSION_COOKIE_NAME = "operator_console_session";

function logInfo(message) {
  console.log(`Tenebrux Veritas: ${message}`);
}

function logError(message) {
  console.error(`Tenebrux Veritas: ${message}`);
}

function isPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const parentWithSep = parent.endsWith(path.sep) ? parent : `${parent}${path.sep}`;
  return candidate === parent || candidate.startsWith(parentWithSep);
}

async function discoverInitialTarget() {
  const repos = await listAttachedRepos({
    repoSearchRoot: config.repoSearchRoot,
    repoAllowList: config.repoAllowList
  });

  if (!repos.length) {
    throw new Error(
      `No attached git repositories found under '${config.repoSearchRoot}'. Set REPO_ALLOWLIST if needed.`
    );
  }

  const configuredRepo = repos.find(
    (repo) => path.resolve(repo.repoRoot) === path.resolve(config.deployRepoRoot)
  );
  const selectedRepo = configuredRepo || repos[0];

  let targetFilePath = config.targetFilePath;
  if (!isPathInside(selectedRepo.repoRoot, targetFilePath)) {
    targetFilePath = path.resolve(selectedRepo.repoRoot, "index.html");
  }

  if (!resolveRepoFilePath(selectedRepo.repoRoot, path.relative(selectedRepo.repoRoot, targetFilePath))) {
    targetFilePath = path.resolve(selectedRepo.repoRoot, "README.md");
  }

  await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
  try {
    await fs.access(targetFilePath);
  } catch {
    await fs.writeFile(targetFilePath, "", "utf8");
  }

  return {
    repoId: selectedRepo.id,
    repoName: selectedRepo.name,
    repoRoot: selectedRepo.repoRoot,
    originRemote: selectedRepo.originRemote,
    branch: selectedRepo.branch,
    targetFilePath,
    previewUrl: config.previewUrl,
    editorMode: "text"
  };
}

function executeDeploymentScript({ targetFilePath, repoRoot }) {
  return new Promise((resolve, reject) => {
    const child = execCallback(
      `"${config.deployScriptPath}"`,
      {
        cwd: config.appRoot,
        timeout: config.deployTimeoutMs,
        maxBuffer: 1024 * 1024 * 10,
        env: {
          ...process.env,
          CONTENT_FILE_PATH: targetFilePath,
          DEPLOY_REPO_ROOT: repoRoot
        }
      },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
          return;
        }
        resolve({ stdout: String(stdout || ""), stderr: String(stderr || "") });
      }
    );

    child.on("error", (error) => {
      reject(error);
    });
  });
}

function getGitHeadSha(repoRoot) {
  return new Promise((resolve) => {
    execCallback(
      "git rev-parse HEAD",
      { cwd: repoRoot, timeout: 10_000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        resolve(String(stdout || "").trim() || null);
      }
    );
  });
}

async function startServer() {
  await ensureRuntimePaths();
  await validateDeployScript();
  await assertAtLeastOneOperator(config.usersFilePath);

  const activeTarget = await discoverInitialTarget();
  const deployState = createDeploymentStateMachine();
  const persistedDeployState = await loadDeploymentState(config.deploymentStatePath);
  if (persistedDeployState) {
    Object.assign(deployState, persistedDeployState);
    if (deployState.phase === "validating" || deployState.phase === "deploying") {
      deployState.phase = "error";
      deployState.phaseUpdatedAt = new Date().toISOString();
      deployState.lastPhaseDetail =
        "Tenebrux Veritas: Server restarted during an in-flight deployment. Review audit and retry deliberately.";
      deployState.runningDeployment = null;
      deployState.lastResult = "error";
      deployState.lastErrorLines = [
        "Recovered from restart while deployment phase was active."
      ];
    }
  }
  await saveDeploymentState(config.deploymentStatePath, deployState);
  const diffCache = new Map();

  const runtime = {
    deployState,
    activeTarget,
    diffCache
  };

  const loginTracker = createLoginTracker({
    limit: config.loginLimit,
    windowMs: config.loginWindowMs
  });

  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      store: new FileStore({
        path: config.sessionsDir,
        ttl: config.sessionIdleMs / 1000,
        reapInterval: 60 * 60,
        retries: 1
      }),
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: config.sessionIdleMs
      }
    })
  );

  app.use(
    createContextsRouter({
      contextsDir: config.contextsDir,
      contextAuditPath: config.contextAuditPath,
      requireOperatorAuth
    })
  );

  registerApiRoutes(app, {
    config,
    runtime,
    sessionCookieName: SESSION_COOKIE_NAME,
    loginTracker,
    requireOperatorAuth,
    getGitHeadSha,
    executeDeploymentScript,
    saveDeploymentState
  });

  app.use(
    createVeritasRouter({
      config,
      requireOperatorAuth,
      runtime,
      getGitHeadSha
    })
  );

  const clientDistPath = path.join(config.appRoot, "client", "dist");
  const clientBuildExists = await fs
    .access(path.join(clientDistPath, "index.html"))
    .then(() => true)
    .catch(() => false);

  if (clientBuildExists) {
    app.use(express.static(clientDistPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  app.listen(config.port, () => {
    logInfo(`Engine online on http://localhost:${config.port}`);
    logInfo(`Active target: ${activeTarget.repoName} -> ${path.relative(activeTarget.repoRoot, activeTarget.targetFilePath)}`);
  });
}

startServer().catch((error) => {
  const reason = error instanceof Error ? error.stack || error.message : String(error);
  logError(reason);
  process.exit(1);
});
