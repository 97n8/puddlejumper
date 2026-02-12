import fs from "node:fs/promises";
import path from "node:path";

async function readExistingLock(lockPath) {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function acquireFileLock(lockPath, timeoutMs, lockPayload) {
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  const now = Date.now();

  async function tryAcquire() {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify(lockPayload)}\n`, "utf8");
      await handle.close();
      return { acquired: true, staleLockCleared: false };
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }

      const existing = await readExistingLock(lockPath);
      const startedAt = Date.parse(existing?.startedAt || "");
      const ageMs = Number.isNaN(startedAt) ? Number.POSITIVE_INFINITY : now - startedAt;

      if (ageMs > timeoutMs) {
        await fs.rm(lockPath, { force: true });
        return { acquired: false, staleLockCleared: true };
      }

      return { acquired: false, staleLockCleared: false };
    }
  }

  const firstAttempt = await tryAcquire();
  if (firstAttempt.acquired || !firstAttempt.staleLockCleared) {
    return firstAttempt;
  }

  const secondAttempt = await tryAcquire();
  return { acquired: secondAttempt.acquired, staleLockCleared: true };
}

export async function releaseFileLock(lockPath) {
  await fs.rm(lockPath, { force: true });
}
