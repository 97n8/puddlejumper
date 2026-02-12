import crypto from "node:crypto";
import path from "node:path";

export function normalizeRelativePath(repoRoot, absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

export function buildTargetId(repoRoot, absolutePath) {
  const source = `${path.resolve(repoRoot)}::${path.resolve(absolutePath)}`;
  return crypto.createHash("sha256").update(source).digest("hex").slice(0, 16);
}

export function summarizeTarget(targetState) {
  const relativeFilePath = normalizeRelativePath(targetState.repoRoot, targetState.targetFilePath);
  const targetId = buildTargetId(targetState.repoRoot, targetState.targetFilePath);

  return {
    targetId,
    repoId: targetState.repoId,
    repoName: targetState.repoName,
    repoRoot: targetState.repoRoot,
    relativeFilePath,
    absoluteFilePath: targetState.targetFilePath,
    previewUrl: targetState.previewUrl,
    editorMode: targetState.editorMode,
    originRemote: targetState.originRemote || "",
    branch: targetState.branch || ""
  };
}

export function defaultReviewConfirmationPhrase(targetSummary) {
  return `DEPLOY ${targetSummary.repoName}:${targetSummary.relativeFilePath}`;
}

