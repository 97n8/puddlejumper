import fs from "node:fs/promises";
import path from "node:path";
import { exec as execCallback } from "node:child_process";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".cache",
  ".next",
  ".vercel",
  "coverage"
]);

const TEXT_EXTENSIONS = new Set([
  ".json",
  ".txt",
  ".md",
  ".html",
  ".htm",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".xml",
  ".yml",
  ".yaml",
  ".csv"
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

function isPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const parentWithSep = parent.endsWith(path.sep) ? parent : `${parent}${path.sep}`;
  return candidate === parent || candidate.startsWith(parentWithSep);
}

function encodeRepoId(repoRoot) {
  return Buffer.from(repoRoot, "utf8").toString("base64url");
}

function decodeRepoId(repoId) {
  try {
    return Buffer.from(repoId, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

function execCommand(command, cwd, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    execCallback(command, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, stdout: "", stderr: String(stderr || error.message || "") });
        return;
      }
      resolve({ ok: true, stdout: String(stdout || ""), stderr: String(stderr || "") });
    });
  });
}

async function readImmediateDirectories(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(rootDir, entry.name));
}

async function isGitRepo(directoryPath) {
  try {
    await fs.access(path.join(directoryPath, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function getRepoRemote(repoRoot) {
  const result = await execCommand("git config --get remote.origin.url", repoRoot);
  return result.ok ? result.stdout.trim() : "";
}

async function getRepoBranch(repoRoot) {
  const result = await execCommand("git rev-parse --abbrev-ref HEAD", repoRoot);
  return result.ok ? result.stdout.trim() : "";
}

function matchQuery(value, query) {
  if (!query) {
    return true;
  }
  return value.toLowerCase().includes(query.toLowerCase());
}

export async function listAttachedRepos({ repoSearchRoot, repoAllowList }) {
  const candidates = [];

  if (repoAllowList.length > 0) {
    for (const repoRoot of repoAllowList) {
      candidates.push(path.resolve(repoRoot));
    }
  } else {
    const topLevel = await readImmediateDirectories(repoSearchRoot);
    for (const candidate of topLevel) {
      candidates.push(path.resolve(candidate));
    }
  }

  const repos = [];
  for (const candidate of candidates) {
    if (!(await isGitRepo(candidate))) {
      continue;
    }

    const name = path.basename(candidate);
    const [originRemote, branch] = await Promise.all([
      getRepoRemote(candidate),
      getRepoBranch(candidate)
    ]);

    repos.push({
      id: encodeRepoId(candidate),
      name,
      repoRoot: candidate,
      originRemote,
      branch
    });
  }

  repos.sort((a, b) => a.name.localeCompare(b.name));
  return repos;
}

export function resolveRepoFromId(repos, repoId) {
  const decodedPath = decodeRepoId(String(repoId || ""));
  if (!decodedPath) {
    return null;
  }

  return repos.find((repo) => path.resolve(repo.repoRoot) === path.resolve(decodedPath)) || null;
}

export function resolveRepoFilePath(repoRoot, relativeFilePath) {
  const normalizedRelative = String(relativeFilePath || "").trim();
  if (!normalizedRelative) {
    return null;
  }

  const candidate = path.resolve(repoRoot, normalizedRelative);
  if (!isPathInside(repoRoot, candidate)) {
    return null;
  }

  return candidate;
}

export function inferEditorMode(filePath, content) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    return "json";
  }

  try {
    JSON.parse(content);
    return "json";
  } catch {
    return "text";
  }
}

export async function listRepoFiles({ repoRoot, query, limit = 250 }) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 250, 1), 500);
  const queue = [repoRoot];
  const files = [];

  while (queue.length > 0 && files.length < normalizedLimit) {
    const currentDir = queue.shift();
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        queue.push(entryPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      const relativePath = toPosixPath(path.relative(repoRoot, entryPath));
      if (!matchQuery(relativePath, query)) {
        continue;
      }

      files.push({
        relativePath,
        absolutePath: entryPath
      });

      if (files.length >= normalizedLimit) {
        break;
      }
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return files;
}
