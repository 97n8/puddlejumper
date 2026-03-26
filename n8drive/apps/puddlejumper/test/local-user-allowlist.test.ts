import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { signJwt } from "@publiclogic/core";
import { createApp } from "../src/api/server.js";
import { createLocalUser, resetLocalUserDb } from "../src/api/localUsersStore.js";

const TEST_DATA_DIR = path.join(os.tmpdir(), `pj-local-allowlist-${Date.now()}`);

describe("/api/me local-user allowlist handling", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.CONNECTOR_STATE_SECRET = "test-local-allowlist-secret";
    process.env.JWT_SECRET = "test-secret-key-at-least-32-chars-long";
    process.env.ALLOWED_EMAILS = "a.cyganiewicz@town.sutton.ma.us";
    process.env.ALLOWED_DOMAINS = "";
  });

  afterEach(() => {
    resetLocalUserDb();
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    delete process.env.DATA_DIR;
    delete process.env.CONNECTOR_STATE_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.ALLOWED_EMAILS;
    delete process.env.ALLOWED_DOMAINS;
  });

  it("allows authenticated local users through /api/me even when the email allowlist does not include them", async () => {
    const localUser = await createLocalUser(TEST_DATA_DIR, {
      username: "n8",
      name: "N8 Demo Operator",
      email: "nboudreauma@gmail.com",
      temporaryPassword: "12345678",
      mustChangePassword: true,
    });

    const token = await signJwt(
      {
        sub: localUser.id,
        name: localUser.name,
        role: "admin",
        workspaceId: "ws-test",
        tenantId: "ws-test",
        tenants: [{ id: "ws-test", name: "Workspace", sha: "", connections: [] }],
        delegations: [],
        mustChangePassword: true,
      } as any,
      { expiresIn: "1h" },
    );

    const app = createApp("test");
    const res = await request(app)
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .set("X-PuddleJumper-Request", "true");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe("nboudreauma@gmail.com");
    expect(res.body.name).toBe("N8 Demo Operator");
    expect(res.body.role).toBe("admin");
  });
});
