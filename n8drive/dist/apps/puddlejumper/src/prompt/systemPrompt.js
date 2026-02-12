import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRIMARY_PROMPT_PATH = path.join(__dirname, "puddle-jumper-product-system-prompt-v0.1.md");
const SECONDARY_PROMPT_PATH = path.join(__dirname, "puddle-jumper-governed-launcher-v1.txt");
const FALLBACK_PROMPT_PATH = path.join(__dirname, "publiclogic-deploy-remote-system-prompt.txt");
export function getSystemPromptText() {
    try {
        return fs.readFileSync(PRIMARY_PROMPT_PATH, "utf8");
    }
    catch {
        try {
            return fs.readFileSync(SECONDARY_PROMPT_PATH, "utf8");
        }
        catch {
            try {
                return fs.readFileSync(FALLBACK_PROMPT_PATH, "utf8");
            }
            catch {
                return "SYSTEM: PUDDLE JUMPER ORCHESTRATOR (prompt source missing)";
            }
        }
    }
}
