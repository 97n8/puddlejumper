import fs from "node:fs/promises";
import path from "node:path";

async function readContextMap(contextPath) {
  try {
    const raw = await fs.readFile(contextPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeContextMap(contextPath, map) {
  await fs.mkdir(path.dirname(contextPath), { recursive: true });
  await fs.writeFile(contextPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

export async function getDeploymentContext(contextPath, targetId) {
  const map = await readContextMap(contextPath);
  return map[targetId] || null;
}

export async function saveDeploymentContext(contextPath, targetId, context) {
  const map = await readContextMap(contextPath);
  map[targetId] = {
    context,
    updatedAt: new Date().toISOString()
  };
  await writeContextMap(contextPath, map);
  return map[targetId];
}

export async function listDeploymentContexts(contextPath) {
  return readContextMap(contextPath);
}

