#!/usr/bin/env node

import path from "node:path";
import dotenv from "dotenv";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
dotenv.config({ path: path.join(repoRoot, ".env") });

// Keep the namespace (don't destructure) and call through it at runtime, so
// tests can spy on these functions. Destructuring captures the originals at
// import time, before any spy is installed.
const migrations = await import("../../puddlejumper/src/api/migrations.ts");

export function parseArgs(argv) {
  const [command = "up", ...rest] = argv;
  const map = new Map();
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      map.set(token, true);
      continue;
    }
    map.set(token, next);
    i += 1;
  }
  return { command, args: map };
}

function resolveCliPaths() {
  const dataDir = path.resolve(process.env.CONTROLLED_DATA_DIR ?? process.env.DATA_DIR ?? path.join(repoRoot, "data"));
  return {
    dataDir,
    prrDbPath: path.resolve(process.env.PRR_DB_PATH ?? path.join(dataDir, "prr.db")),
    approvalDbPath: path.resolve(process.env.APPROVAL_DB_PATH ?? path.join(dataDir, "approvals.db")),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const { dataDir, prrDbPath, approvalDbPath } = resolveCliPaths();
  const { command, args } = parseArgs(argv);

  if (command === "up") {
    const result = migrations.runPuddleJumperMigrations({
      dataDir,
      prrDbPath,
      approvalDbPath,
    });
    for (const filename of result.applied) process.stdout.write(`APPLIED ${filename}\n`);
    for (const filename of result.skipped) process.stdout.write(`SKIPPED ${filename}\n`);
    return;
  }

  if (command === "mark-applied") {
    const database = args.get("--database");
    const filename = args.get("--filename");
    const acknowledged = args.get("--out-of-band-applied");
    if (!database || !filename || acknowledged !== true) {
      throw new Error(
        "Usage: migrate.mjs mark-applied --database <prr|approvals|audit> --filename <migration.sql> --out-of-band-applied",
      );
    }
    const record = migrations.markPuddleJumperMigrationApplied({
      dataDir,
      prrDbPath,
      approvalDbPath,
      database,
      filename,
    });
    process.stdout.write(`MARKED ${record.filename} ${record.applied_at} ${record.apply_method}\n`);
    return;
  }

  throw new Error("Usage: migrate.mjs <up|mark-applied> [options]");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
