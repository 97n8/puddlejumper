import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertProductionInvariants } from "../src/api/config.js";
import type { AuthOptions } from "@publiclogic/core";
import os from "node:os";
import path from "node:path";

// ── Helpers ─────────────────────────────────────────────────────────────────

const CONTROLLED_DIR = "/app/data";

function validAuthOptions(): AuthOptions {
  return { jwtSecret: "a-real-secret-not-dev", algorithm: "HS256" };
}

/** Set all required env vars so assertProductionInvariants doesn't throw for unrelated reasons. */
function setRequiredEnv(): void {
  process.env.PJ_RUNTIME_CONTEXT_JSON = '{"workspace":{"id":"ws"}}';
  process.env.PJ_RUNTIME_TILES_JSON = '[{"id":"t"}]';
  process.env.PJ_RUNTIME_CAPABILITIES_JSON = '{"automations":[]}';
  process.env.PRR_DB_PATH = "/app/data/prr.db";
  process.env.IDEMPOTENCY_DB_PATH = "/app/data/idem.db";
  process.env.RATE_LIMIT_DB_PATH = "/app/data/rate.db";
  process.env.CONNECTOR_DB_PATH = "/app/data/conn.db";
  process.env.CONNECTOR_STATE_SECRET = "prod-secret";
  process.env.ACCESS_NOTIFICATION_WEBHOOK_URL = "https://hook.example.com";
  process.env.FRONTEND_URL = "https://pj.publiclogic.org";
  // OAuth: all three providers
  process.env.GITHUB_CLIENT_ID = "gh-id";
  process.env.GITHUB_CLIENT_SECRET = "gh-secret";
  process.env.GITHUB_REDIRECT_URI = "https://example.com/api/auth/github/callback";
  process.env.GOOGLE_CLIENT_ID = "go-id";
  process.env.GOOGLE_CLIENT_SECRET = "go-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://example.com/api/auth/google/callback";
  process.env.MICROSOFT_CLIENT_ID = "ms-id";
  process.env.MICROSOFT_CLIENT_SECRET = "ms-secret";
  process.env.MICROSOFT_REDIRECT_URI = "https://example.com/api/auth/microsoft/callback";
}

const envSnapshot: Record<string, string | undefined> = {};
const trackedKeys = [
  "PJ_RUNTIME_CONTEXT_JSON", "PJ_RUNTIME_TILES_JSON", "PJ_RUNTIME_CAPABILITIES_JSON",
  "PRR_DB_PATH", "IDEMPOTENCY_DB_PATH", "RATE_LIMIT_DB_PATH", "CONNECTOR_DB_PATH",
  "CONNECTOR_STATE_SECRET", "ACCESS_NOTIFICATION_WEBHOOK_URL", "FRONTEND_URL",
  "ALLOW_ADMIN_LOGIN", "ALLOW_PROD_ADMIN_LOGIN",
  "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GITHUB_REDIRECT_URI",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI",
  "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI",
];

beforeEach(() => {
  for (const key of trackedKeys) {
    envSnapshot[key] = process.env[key];
  }
});

afterEach(() => {
  for (const key of trackedKeys) {
    if (envSnapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = envSnapshot[key];
    }
  }
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("assertProductionInvariants", () => {
  it("passes with all required env vars set", () => {
    setRequiredEnv();
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).not.toThrow();
  });

  it("skips validation when nodeEnv is not production", () => {
    // No env vars set at all — should not throw
    expect(() => assertProductionInvariants("development", validAuthOptions(), CONTROLLED_DIR)).not.toThrow();
  });

  it("throws when FRONTEND_URL is missing in production", () => {
    setRequiredEnv();
    delete process.env.FRONTEND_URL;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "FRONTEND_URL must be configured in production"
    );
  });

  it("throws when JWT secret uses dev fallback in production", () => {
    setRequiredEnv();
    expect(() =>
      assertProductionInvariants("production", { jwtSecret: "dev-secret", algorithm: "HS256" }, CONTROLLED_DIR)
    ).toThrow("JWT secret cannot use development fallback");
  });

  it("throws when OAuth client ID is set without client secret", () => {
    setRequiredEnv();
    delete process.env.GITHUB_CLIENT_SECRET;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "GitHub OAuth: both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set"
    );
  });

  it("throws when OAuth client secret is set without client ID", () => {
    setRequiredEnv();
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "Google OAuth: both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set"
    );
  });

  it("throws when redirect URI is missing for configured provider", () => {
    setRequiredEnv();
    delete process.env.MICROSOFT_REDIRECT_URI;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "Microsoft OAuth: MICROSOFT_REDIRECT_URI must be configured when MICROSOFT_CLIENT_ID is set"
    );
  });

  it("allows OAuth provider to be entirely unconfigured (both ID and secret unset)", () => {
    setRequiredEnv();
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.GITHUB_REDIRECT_URI;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).not.toThrow();
  });

  it("throws when CONNECTOR_STATE_SECRET is missing in production", () => {
    setRequiredEnv();
    delete process.env.CONNECTOR_STATE_SECRET;
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "CONNECTOR_STATE_SECRET is required in production"
    );
  });

  it("throws when DB path is outside controlled directory", () => {
    setRequiredEnv();
    process.env.PRR_DB_PATH = "/tmp/rogue.db";
    expect(() => assertProductionInvariants("production", validAuthOptions(), CONTROLLED_DIR)).toThrow(
      "PRR_DB_PATH must be inside the controlled data directory"
    );
  });
});
