import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, StartupConfigError, startupConfigSchema } from "../src/api/startupConfig.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid env for loadConfig. */
function validEnv(): Record<string, string> {
  return {
    JWT_SECRET: "super-secret-key-that-is-at-least-32-characters-long",
    AUTH_ISSUER: "https://auth.example.com",
    AUTH_AUDIENCE: "https://api.example.com",
    PRR_DB_PATH: "/app/data/prr.db",
    CONNECTOR_DB_PATH: "/app/data/connectors.db",
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("loadConfig", () => {
  it("succeeds with all required env vars", () => {
    const config = loadConfig(validEnv());
    expect(config.JWT_SECRET).toBe("super-secret-key-that-is-at-least-32-characters-long");
    expect(config.AUTH_ISSUER).toBe("https://auth.example.com");
    expect(config.AUTH_AUDIENCE).toBe("https://api.example.com");
    expect(config.PRR_DB_PATH).toBe("/app/data/prr.db");
    expect(config.CONNECTOR_DB_PATH).toBe("/app/data/connectors.db");
  });

  it("succeeds with optional vars present", () => {
    const env = {
      ...validEnv(),
      METRICS_TOKEN: "prom-token",
      FRONTEND_URL: "https://pj.publiclogic.org",
      LOGIC_COMMONS_DATA_DIR: "/mnt/data",
    };
    const config = loadConfig(env);
    expect(config.METRICS_TOKEN).toBe("prom-token");
    expect(config.FRONTEND_URL).toBe("https://pj.publiclogic.org");
    expect(config.LOGIC_COMMONS_DATA_DIR).toBe("/mnt/data");
  });

  it("succeeds without optional vars", () => {
    const config = loadConfig(validEnv());
    expect(config.METRICS_TOKEN).toBeUndefined();
    expect(config.FRONTEND_URL).toBeUndefined();
    expect(config.LOGIC_COMMONS_DATA_DIR).toBeUndefined();
  });

  describe("required var missing → throws StartupConfigError", () => {
    const requiredKeys = [
      "JWT_SECRET",
      "AUTH_ISSUER",
      "AUTH_AUDIENCE",
    ] as const;

    for (const key of requiredKeys) {
      it(`missing ${key}`, () => {
        const env = validEnv();
        delete (env as Record<string, string | undefined>)[key];
        expect(() => loadConfig(env)).toThrow(StartupConfigError);
      });

      it(`empty ${key}`, () => {
        const env = { ...validEnv(), [key]: "" };
        expect(() => loadConfig(env)).toThrow(StartupConfigError);
      });

      it(`whitespace-only ${key}`, () => {
        const env = { ...validEnv(), [key]: "   " };
        expect(() => loadConfig(env)).toThrow(StartupConfigError);
      });
    }
  });

  it("error message lists all missing vars", () => {
    try {
      loadConfig({});
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(StartupConfigError);
      const e = err as StartupConfigError;
      expect(e.message).toContain("JWT_SECRET");
      expect(e.message).toContain("AUTH_ISSUER");
      expect(e.message).toContain("AUTH_AUDIENCE");
      expect(e.issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("trims whitespace from required values", () => {
    const env = {
      ...validEnv(),
      JWT_SECRET: "  my-secret-that-is-at-least-32-characters-long  ",
    };
    const config = loadConfig(env);
    expect(config.JWT_SECRET).toBe("my-secret-that-is-at-least-32-characters-long");
  });

  it("rejects invalid FRONTEND_URL when provided", () => {
    const env = { ...validEnv(), FRONTEND_URL: "not-a-url" };
    expect(() => loadConfig(env)).toThrow(StartupConfigError);
  });

  it("rejects JWT_SECRET shorter than 32 characters", () => {
    const env = { ...validEnv(), JWT_SECRET: "too-short" };
    expect(() => loadConfig(env)).toThrow(StartupConfigError);
    try {
      loadConfig(env);
    } catch (err) {
      expect((err as StartupConfigError).message).toContain("32 characters");
    }
  });

  it("accepts empty string for FRONTEND_URL (treated as undefined)", () => {
    const env = { ...validEnv(), FRONTEND_URL: "" };
    const config = loadConfig(env);
    expect(config.FRONTEND_URL).toBeUndefined();
  });
});
