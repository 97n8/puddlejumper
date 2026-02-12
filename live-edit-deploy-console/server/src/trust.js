import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";

function isPathInside(parentPath, candidatePath) {
  const parent = path.resolve(parentPath);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export async function assertTrustedDeployScript(deployScriptPath, allowedRootPaths) {
  const candidateRoots = Array.isArray(allowedRootPaths)
    ? allowedRootPaths
    : [allowedRootPaths];
  const filteredRoots = candidateRoots.filter(Boolean);

  const resolvedScriptPath = await fs.realpath(deployScriptPath);
  const resolvedAllowedRootPaths = await Promise.all(filteredRoots.map((rootPath) => fs.realpath(rootPath)));
  const insideAllowedRoot = resolvedAllowedRootPaths.some((rootPath) =>
    isPathInside(rootPath, resolvedScriptPath)
  );

  if (!insideAllowedRoot) {
    throw new Error(
      `Deploy script '${resolvedScriptPath}' is outside allowed roots: ${resolvedAllowedRootPaths.join(", ")}.`
    );
  }

  const scriptStats = await fs.stat(resolvedScriptPath);
  if (!scriptStats.isFile()) {
    throw new Error(`Deploy script path '${resolvedScriptPath}' is not a file.`);
  }

  await fs.access(resolvedScriptPath, fsConstants.X_OK);
  return resolvedScriptPath;
}

export async function computeFileSha256(filePath) {
  const contents = await fs.readFile(filePath);
  const digest = crypto.createHash("sha256").update(contents).digest("hex");
  return `sha256:${digest}`;
}
