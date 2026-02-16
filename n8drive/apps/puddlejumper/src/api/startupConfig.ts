// ── Startup configuration validation ────────────────────────────────────────
//
// Validates required and optional environment variables at process start using
// zod.  On failure the process logs formatted errors and exits non-zero.
//
// This intentionally lives separate from config.ts (runtime helpers &
// assertProductionInvariants) to keep responsibilities clear:
//   startupConfig.ts  – boot-time schema validation (all envs)
//   config.ts         – runtime accessors & production-only assertions

import { z } from "zod";

// ── Schema ──────────────────────────────────────────────────────────────────

/** Non-empty trimmed string (rejects "" and whitespace-only). */
const nonEmptyString = z.string().trim().min(1);

export const DEFAULT_PRR_DB_PATH = "./data/prr.db";
export const DEFAULT_CONNECTOR_DB_PATH = "./data/connectors.db";

/** Optional path env that trims input and falls back to the provided default when missing or blank. */
const optionalPathWithDefault = (defaultPath: string) =>
  z.string().optional().transform((value) => (value ?? "").trim() || defaultPath);

/**
 * Zod schema for the startup environment.
 *
 * "Required" means the server MUST NOT start without them.
 * "Optional" are documented but allowed to be absent.
 */
export const startupConfigSchema = z.object({
  // ── Required ────────────────────────────────────────────────────────
  JWT_SECRET: nonEmptyString,
  AUTH_ISSUER: nonEmptyString,
  AUTH_AUDIENCE: nonEmptyString,
  PRR_DB_PATH: optionalPathWithDefault(DEFAULT_PRR_DB_PATH),
  CONNECTOR_DB_PATH: optionalPathWithDefault(DEFAULT_CONNECTOR_DB_PATH),

  // ── Optional ────────────────────────────────────────────────────────
  METRICS_TOKEN: z.string().optional(),
  FRONTEND_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  LOGIC_COMMONS_DATA_DIR: z.string().optional(),
});

export type AppConfig = z.infer<typeof startupConfigSchema>;

// ── Loader ──────────────────────────────────────────────────────────────────

/**
 * Parse and validate startup configuration from `process.env`.
 *
 * Returns a typed `AppConfig` on success.
 * Throws a `StartupConfigError` with formatted messages on failure.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = startupConfigSchema.safeParse(env);

  if (!result.success) {
    const messages = result.error.issues.map(
      (issue) => `  • ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new StartupConfigError(
      `Startup config validation failed:\n${messages.join("\n")}`,
      result.error.issues,
    );
  }

  return result.data;
}

/** Typed error thrown by loadConfig() so callers can inspect issues programmatically. */
export class StartupConfigError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = "StartupConfigError";
    this.issues = issues;
  }
}
