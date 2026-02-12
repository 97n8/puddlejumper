import fs from "node:fs/promises";
import path from "node:path";

async function readJsonLines(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
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

export async function appendVeritasMemoryEntry(memoryPath, entry) {
  await fs.mkdir(path.dirname(memoryPath), { recursive: true });
  await fs.appendFile(memoryPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function listVeritasMemoryEntries(memoryPath, { clientQuery = "" } = {}) {
  const entries = await readJsonLines(memoryPath);
  const filtered = entries.filter((entry) => {
    if (!clientQuery) {
      return true;
    }

    const haystack =
      `${entry.client || ""} ${entry.operator || ""} ${entry.reason || ""} ${entry.notes || ""}`.toLowerCase();
    return haystack.includes(clientQuery.toLowerCase());
  });

  filtered.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  return filtered;
}

export function entriesToCsv(entries) {
  const header = [
    "timestamp",
    "client",
    "environment",
    "reason",
    "canon_version",
    "deployment_id",
    "operator",
    "notes"
  ];

  const lines = [header.join(",")];
  for (const entry of entries) {
    const row = [
      entry.timestamp,
      entry.client,
      entry.environment,
      entry.reason,
      entry.canon_version,
      entry.deployment_id,
      entry.operator,
      entry.notes
    ].map((value) => `"${String(value || "").replace(/"/g, "\"\"")}"`);

    lines.push(row.join(","));
  }

  return `${lines.join("\n")}\n`;
}
