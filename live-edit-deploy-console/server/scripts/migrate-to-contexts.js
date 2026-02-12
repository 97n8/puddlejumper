import fs from "node:fs";
import path from "node:path";

import { fromLegacyDeploymentContext } from "../models/DeploymentContext.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const LEGACY_PATH = path.join(DATA_DIR, "deployment-context.json");
const CONTEXTS_DIR = path.join(DATA_DIR, "contexts");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function migrate() {
  console.log("Starting migration to multi-tenant contexts...");

  if (!fs.existsSync(CONTEXTS_DIR)) {
    fs.mkdirSync(CONTEXTS_DIR, { recursive: true });
    console.log("✓ Created contexts directory");
  }

  if (!fs.existsSync(LEGACY_PATH)) {
    console.log("No legacy deployment-context.json found. Nothing to migrate.");
    return;
  }

  const legacyMap = readJson(LEGACY_PATH);
  if (!legacyMap || typeof legacyMap !== "object" || Array.isArray(legacyMap)) {
    console.log("Legacy deployment-context.json is not a valid object map. Migration aborted.");
    process.exitCode = 1;
    return;
  }

  let migrated = 0;
  for (const [targetId, data] of Object.entries(legacyMap)) {
    const sourceContext = data?.context && typeof data.context === "object" ? data.context : null;
    if (!sourceContext) {
      continue;
    }

    const converted = fromLegacyDeploymentContext(sourceContext, {
      targetId,
      updatedAt: data?.updatedAt,
      operator: "migration-script"
    });

    const contextPath = path.join(CONTEXTS_DIR, `${converted.contextId}.json`);
    if (fs.existsSync(contextPath)) {
      console.log(`↷ Skipping existing context ${converted.contextId}`);
      continue;
    }

    const enriched = {
      ...converted,
      _migratedFrom: targetId
    };

    writeJson(contextPath, enriched);
    console.log(`✓ Migrated ${enriched.clientShortName || targetId} -> ${enriched.contextId}`);
    migrated += 1;
  }

  const backupPath = `${LEGACY_PATH}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(LEGACY_PATH, backupPath);
    console.log(`✓ Backed up legacy file to ${backupPath}`);
  } else {
    console.log(`↷ Backup already exists at ${backupPath}`);
  }

  console.log(`\nMigration complete! ${migrated} context(s) migrated.`);
  console.log("You can now transition workflows to /contexts endpoints.");
}

migrate();
