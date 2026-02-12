import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_AUDIT_ENTRIES = 500;

export function excerptText(raw, maxChars = 4000) {
  if (!raw) {
    return "";
  }
  const trimmed = String(raw).trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(trimmed.length - maxChars);
}

export function getLastLines(raw, maxLines = 50) {
  if (!raw) {
    return [];
  }

  const lines = String(raw).split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function stripChainFields(entry) {
  const next = {
    ...(entry && typeof entry === "object" ? entry : {})
  };
  delete next.prev_hash;
  delete next.entry_hash;
  return next;
}

function computeEntryHash(prevHash, entryWithoutChain) {
  const canonical = stableStringify(entryWithoutChain);
  return crypto.createHash("sha256").update(`${prevHash}\n${canonical}`, "utf8").digest("hex");
}

function applyAuditHashChain(entries) {
  let previousHash = "";

  return entries.map((entry) => {
    const base = stripChainFields(entry);
    const entryHash = computeEntryHash(previousHash, base);
    const chained = {
      ...base,
      prev_hash: previousHash,
      entry_hash: entryHash
    };
    previousHash = entryHash;
    return chained;
  });
}

export async function readAuditEntries(auditLogPath) {
  try {
    const raw = await fs.readFile(auditLogPath, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function appendAuditEntry(auditLogPath, entry) {
  await fs.mkdir(path.dirname(auditLogPath), { recursive: true });
  const existing = await readAuditEntries(auditLogPath);
  const nextChained = applyAuditHashChain([...existing, entry]);
  const trimmed = nextChained.slice(-MAX_AUDIT_ENTRIES);
  const reChained = applyAuditHashChain(trimmed);
  const output = `${reChained.map((item) => JSON.stringify(item)).join("\n")}\n`;
  await fs.writeFile(auditLogPath, output, "utf8");

  return reChained[reChained.length - 1] || null;
}
