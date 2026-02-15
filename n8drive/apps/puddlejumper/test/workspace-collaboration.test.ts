// ── Workspace Collaboration Tests ──────────────────────────────────────
//
// Tests for multi-user collaboration features:
//  - Invitations (create, list, revoke, expire, accept)
//  - Member management (list, remove, update role)
//  - Permission enforcement (role hierarchy)
//  - Tier limits on member count
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import cookieParser from "cookie-parser";
import type { AuthOptions } from "@publiclogic/core";
import {
  createJwtAuthenticationMiddleware,
  signJwt,
} from "@publiclogic/core";
import { createWorkspaceCollaborationRoutes } from "../src/api/routes/workspaceCollaboration.js";
import { withCorrelationId } from "../src/api/serverMiddleware.js";
import {
  resetWorkspaceDb,
  ensurePersonalWorkspace,
  updateWorkspacePlan,
  createInvitation,
  getInvitationByToken,
} from "../src/engine/workspaceStore.js";

const TEST_DATA_DIR = "./test-data";
const JWT_SECRET = "test-jwt-secret-for-workspace-collaboration";

// Set env vars for signJwt
process.env.JWT_SECRET = JWT_SECRET;
process.env.AUTH_ISSUER = "test-issuer";
process.env.AUTH_AUDIENCE = "test-audience";

describe("Workspace Collaboration", () => {
  let app: express.Express;

  beforeEach(() => {
    resetWorkspaceDb();
    
    const authOptions: AuthOptions = {
      jwtSecret: JWT_SECRET,
      jwtExpirationSeconds: 3600,
      cookieName: "pj_session",
      secureCookie: false,
    };

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(withCorrelationId);
    app.use(createJwtAuthenticationMiddleware(authOptions));
    app.use("/api", createWorkspaceCollaborationRoutes());
  });

  async function makeToken(payload: any): Promise<string> {
    return await signJwt(payload, { expiresIn: "1h" });
  }

  describe("POST /api/workspace/invite", () => {
    it("owner can create invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro"); // Allow multiple members
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "bob@example.com", role: "member" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeTruthy();
      expect(res.body.data.expiresAt).toBeTruthy();
    });

    it("admin can create invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro"); // Allow multiple members
      // Manually add user2 as admin
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "charlie@example.com", role: "viewer" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("member cannot create invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "dave@example.com", role: "member" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    it("viewer cannot create invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "viewer", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "eve@example.com", role: "member" });

      expect(res.status).toBe(403);
    });

    it("requires email and role", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro"); // Allow multiple members
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "test@example.com" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("role required");
    });

    it("rejects invalid role", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro"); // Allow multiple members
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "test@example.com", role: "superadmin" });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid role");
    });

    it("free tier blocks invite when at member limit", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      // Free tier limit is 1 member (owner)
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "test@example.com", role: "member" });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe("tier_limit");
      expect(res.body.plan).toBe("free");
      expect(res.body.limit).toBe(1);
    });

    it("pro tier allows up to 10 members", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro");
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/invite")
        .set("Authorization", `Bearer ${token}`)
        .send({ email: "test@example.com", role: "member" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /api/workspace/invitations", () => {
    it("owner can list invitations", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      createInvitation(TEST_DATA_DIR, ws.id, "bob@example.com", "member", "user1");
      createInvitation(TEST_DATA_DIR, ws.id, "charlie@example.com", "viewer", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .get("/api/workspace/invitations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("admin can list invitations", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      createInvitation(TEST_DATA_DIR, ws.id, "test@example.com", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .get("/api/workspace/invitations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("member cannot list invitations", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .get("/api/workspace/invitations")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/workspace/invitations/:id", () => {
    it("owner can revoke invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "bob@example.com", "member", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete(`/api/workspace/invitations/${inv.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("admin can revoke invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "test@example.com", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete(`/api/workspace/invitations/${inv.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("member cannot revoke invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "test@example.com", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete(`/api/workspace/invitations/${inv.id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/invitations/:token/accept", () => {
    it("accepts valid invitation and adds member", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro"); // Allow multiple members
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "bob@example.com", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: "ws-user2", role: "admin"  });

      const res = await request(app)
        .post(`/api/invitations/${inv.token}/accept`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.workspaceId).toBe(ws.id);
      expect(res.body.data.role).toBe("member");

      // Verify member was added
      const { getMemberRole } = await import("../src/engine/workspaceStore.js");
      const role = getMemberRole(TEST_DATA_DIR, ws.id, "user2");
      expect(role).toBe("member");
    });

    it("rejects expired invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "bob@example.com", "member", "user1");
      
      // Manually expire the invitation
      const { getDb } = await import("../src/engine/workspaceStore.js");
      const db = getDb(TEST_DATA_DIR);
      db.prepare(`UPDATE workspace_invitations SET expires_at = datetime('now', '-1 day') WHERE token = ?`).run(inv.token);
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: "ws-user2", role: "admin"  });

      const res = await request(app)
        .post(`/api/invitations/${inv.token}/accept`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(410);
      expect(res.body.error).toBe("Invitation expired");
    });

    it("rejects invalid token", async () => {
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: "ws-user2", role: "admin"  });

      const res = await request(app)
        .post("/api/invitations/invalid-token/accept")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Invitation not found");
    });

    it("increments member count when accepting invitation", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      updateWorkspacePlan(TEST_DATA_DIR, ws.id, "pro");
      const inv = createInvitation(TEST_DATA_DIR, ws.id, "bob@example.com", "admin", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: "ws-user2", role: "admin"  });

      await request(app)
        .post(`/api/invitations/${inv.token}/accept`)
        .set("Authorization", `Bearer ${token}`);

      const { getWorkspace } = await import("../src/engine/workspaceStore.js");
      const updated = getWorkspace(TEST_DATA_DIR, ws.id);
      expect(updated?.member_count).toBe(2);
    });
  });

  describe("GET /api/workspace/members", () => {
    it("all roles can list members", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "viewer", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .get("/api/workspace/members")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("PATCH /api/workspace/members/:userId", () => {
    it("owner can update member role", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .patch("/api/workspace/members/user2")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      
      const { getMemberRole } = await import("../src/engine/workspaceStore.js");
      const role = getMemberRole(TEST_DATA_DIR, ws.id, "user2");
      expect(role).toBe("admin");
    });

    it("admin cannot update member role (owner only)", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user3", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .patch("/api/workspace/members/user3")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "viewer" });

      expect(res.status).toBe(403);
    });

    it("rejects invalid role", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .patch("/api/workspace/members/user2")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "superuser" });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/workspace/members/:userId", () => {
    it("owner can remove member", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete("/api/workspace/members/user2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      
      const { getMemberRole } = await import("../src/engine/workspaceStore.js");
      const role = getMemberRole(TEST_DATA_DIR, ws.id, "user2");
      expect(role).toBeNull();
    });

    it("admin can remove member", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user3", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete("/api/workspace/members/user3")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("member cannot remove member", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user3", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete("/api/workspace/members/user3")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it("cannot remove owner", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete("/api/workspace/members/user1")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Cannot remove owner");
    });

    it("cannot remove self (must use leave)", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .delete("/api/workspace/members/user2")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Cannot remove yourself");
    });

    it("decrements member count when removing member", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      await request(app)
        .delete("/api/workspace/members/user2")
        .set("Authorization", `Bearer ${token}`);

      const { getWorkspace } = await import("../src/engine/workspaceStore.js");
      const updated = getWorkspace(TEST_DATA_DIR, ws.id);
      expect(updated?.member_count).toBe(1);
    });
  });

  describe("POST /api/workspace/leave", () => {
    it("member can leave workspace", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/leave")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      
      const { getMemberRole } = await import("../src/engine/workspaceStore.js");
      const role = getMemberRole(TEST_DATA_DIR, ws.id, "user2");
      expect(role).toBeNull();
    });

    it("owner cannot leave", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const token = await makeToken({ sub: "user1", userId: "user1", username: "user1", email: "user1@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      const res = await request(app)
        .post("/api/workspace/leave")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Owner cannot leave");
    });

    it("decrements member count when leaving", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      
      const token = await makeToken({ sub: "user2", userId: "user2", username: "user2", email: "user2@test.com", tenantId: "test", workspaceId: ws.id, role: "admin"  });

      await request(app)
        .post("/api/workspace/leave")
        .set("Authorization", `Bearer ${token}`);

      const { getWorkspace } = await import("../src/engine/workspaceStore.js");
      const updated = getWorkspace(TEST_DATA_DIR, ws.id);
      expect(updated?.member_count).toBe(1);
    });
  });

  describe("Duplicate member prevention", () => {
    it("cannot add same member twice", async () => {
      const ws = ensurePersonalWorkspace(TEST_DATA_DIR, "user1", "Alice");
      const { addWorkspaceMember } = await import("../src/engine/workspaceStore.js");
      addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "member", "user1");
      
      expect(() => {
        addWorkspaceMember(TEST_DATA_DIR, ws.id, "user2", "admin", "user1");
      }).toThrow();
    });
  });
});
