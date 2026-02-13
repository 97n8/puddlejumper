import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "../../");

/**
 * Returns the default controlled data directory for the given runtime environment.
 * Production defaults to the persistent `/data` mount (assumes a volume is mounted there);
 * all others use the local `data` folder.
 */
function defaultControlledDataDir(nodeEnv: string): string {
  if (nodeEnv === "production") {
    return "/data";
  }
  return path.join(ROOT_DIR, "data");
}

/**
 * Resolves the controlled data directory, honoring the PJ_CONTROLLED_DATA_DIR override when present.
 */
export function resolveControlledDataDir(nodeEnv: string = process.env.NODE_ENV ?? "development"): string {
  const override = (process.env.PJ_CONTROLLED_DATA_DIR ?? "").trim();
  if (override) {
    return path.resolve(override);
  }
  return path.resolve(defaultControlledDataDir(nodeEnv));
}
