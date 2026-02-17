import './setup-admin';

// ── Tier Enforcement Tests ─────────────────────────────────────────────────
//
// Tests for tier limit enforcement, usage tracking, and plan upgrades.
//
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ApprovalStore } from "../src/engine/approvalStore.js";
import { ChainStore } from "../src/engine/chainStore.js";
import {
  createWorkspace,
  getWorkspace,
  incrementApprovalCount,
  decrementApprovalCount,
  incrementTemplateCount,
  decrementTemplateCount,
  updateWorkspacePlan,
  resetWorkspaceDb,
} from "../src/engine/workspaceStore.js";
import { getTierLimits, TIER_LIMITS } from "../src/config/tierLimits.js";
import { createApp } from "../src/api/server.js";
import supertest from "supertest";
import { signJwt } from "@publiclogic/core";

const TEST_DATA_DIR = path.join(process.cwd(), "test-data", "tier-enforcement");
const TEST_DB_PATH = path.join(TEST_DATA_DIR, "approvals.db");

describe("Tier Enforcement", () => {
  let chainStore: ChainStore;
  let approvalStore: ApprovalStore;
  let app: any;
  let request: any;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });

    // Reset workspace DB
    resetWorkspaceDb();

    // Create stores
    approvalStore = new ApprovalStore(TEST_DB_PATH);
    chainStore = new ChainStore(approvalStore.db);

    // Create test workspaces
    createWorkspace(TEST_DATA_DIR, "ws-free", "Free Workspace", "user-free");
    createWorkspace(TEST_DATA_DIR, "ws-pro", "Pro Workspace", "user-pro");

    // Upgrade pro workspace
    updateWorkspacePlan(TEST_DATA_DIR, "ws-pro", "pro");

    // Set up test app
    process.env.DATA_DIR = TEST_DATA_DIR;
    process.env.JWT_SECRET = "test-secret-key-at-least-32-chars-long";
    process.env.NODE_ENV = "test";
    app = createApp();
    request = supertest(app);

    // Generate test tokens
    adminToken = await signJwt(
      {
        sub: "admin-user",
        userId: "admin-user",
        username: "admin",
        email: "admin@test.com",
        tenantId: "test-tenant",
        workspaceId: "ws-free",
        role: "admin",
      },
      { expiresIn: "1h" }
    );

    userToken = await signJwt(
      {
        sub: "regular-user",
        userId: "regular-user",
        username: "user",
        email: "user@test.com",
        tenantId: "test-tenant",
        workspaceId: "ws-free",
        role: "user",
      },
      { expiresIn: "1h" }
    );
  });

  afterEach(() => {
    approvalStore.close();
    resetWorkspaceDb();
    if (fs.existsSync(TEST_DATA_DIR)) {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    }
  });

  describe("Tier Limits Configuration", () => {
    it("should have correct free tier limits", () => {
      const limits = getTierLimits("free");
      expect(limits.templates).toBe(3);
      expect(limits.approvals).toBe(50);
      expect(limits.members).toBe(1);
    });

    it("should have correct pro tier limits", () => {
      const limits = getTierLimits("pro");
      expect(limits.templates).toBe(25);
      expect(limits.approvals).toBe(Infinity);
      expect(limits.members).toBe(10);
    });

    it("should default to free tier for unknown plans", () => {
      const limits = getTierLimits("unknown" as any);
      expect(limits).toEqual(TIER_LIMITS.free);
    });
  });

  describe("Template Creation Limits", () => {
    it("should allow template creation under free tier limit", async () => {
      const response = await request
        .post("/api/chain-templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({
          name: "Test Template 1",
          description: "Test description",
          steps: [{ order: 0, requiredRole: "admin", label: "Admin Review" }],
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const workspace = getWorkspace(TEST_DATA_DIR, "ws-free");
      expect(workspace?.template_count).toBe(1);
    });

    it("should block template creation at free tier limit", async () => {
      // Create 3 templates to hit the limit
      for (let i = 0; i < 3; i++) {
        incrementTemplateCount(TEST_DATA_DIR, "ws-free");
      }

      const response = await request
        .post("/api/chain-templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({
          name: "Over Limit Template",
          description: "Should fail",
          steps: [{ order: 0, requiredRole: "admin", label: "Admin Review" }],
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("tier_limit");
      expect(response.body.plan).toBe("free");
      expect(response.body.limit).toBe(3);
      expect(response.body.current).toBe(3);
    });

    it("should allow pro tier to exceed free limits", async () => {
      const proToken = await signJwt(
        {
          sub: "pro-admin",
          userId: "pro-admin",
          username: "proadmin",
          email: "proadmin@test.com",
          tenantId: "test-tenant",
          workspaceId: "ws-pro",
          role: "admin",
        },
        { expiresIn: "1h" }
      );

      // Create 5 templates (exceeds free tier limit of 3)
      for (let i = 0; i < 5; i++) {
        const response = await request
          .post("/api/chain-templates")
          .set("Authorization", `Bearer ${proToken}`)
          .set("X-PuddleJumper-Request", "true")
          .send({
            name: `Pro Template ${i}`,
            description: "Pro tier template",
            steps: [{ order: 0, requiredRole: "admin", label: "Admin Review" }],
          });

        expect(response.status).toBe(201);
      }

      const workspace = getWorkspace(TEST_DATA_DIR, "ws-pro");
      expect(workspace?.template_count).toBe(5);
    });

    it("should decrement count on template deletion", async () => {
      // Create a template
      const createResponse = await request
        .post("/api/chain-templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({
          name: "Deletable Template",
          description: "Will be deleted",
          steps: [{ order: 0, requiredRole: "admin", label: "Admin Review" }],
        });

      const templateId = createResponse.body.data.id;
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.template_count).toBe(1);

      // Delete it
      const deleteResponse = await request
        .delete(`/api/chain-templates/${templateId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true");

      expect(deleteResponse.status).toBe(200);
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.template_count).toBe(0);
    });
  });

  describe("Counter Functions", () => {
    it("should increment and decrement approval count", () => {
      incrementApprovalCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.approval_count).toBe(1);

      incrementApprovalCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.approval_count).toBe(2);

      decrementApprovalCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.approval_count).toBe(1);
    });

    it("should not decrement approval count below zero", () => {
      decrementApprovalCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.approval_count).toBe(0);
    });

    it("should increment and decrement template count", () => {
      incrementTemplateCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.template_count).toBe(1);

      decrementTemplateCount(TEST_DATA_DIR, "ws-free");
      expect(getWorkspace(TEST_DATA_DIR, "ws-free")?.template_count).toBe(0);
    });
  });

  describe("Workspace Usage Endpoint", () => {
    it("should return current usage and limits", async () => {
      incrementApprovalCount(TEST_DATA_DIR, "ws-free");
      incrementTemplateCount(TEST_DATA_DIR, "ws-free");

      const response = await request
        .get("/api/workspace/usage")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe("free");
      expect(response.body.data.limits.templates).toBe(3);
      expect(response.body.data.limits.approvals).toBe(50);
      expect(response.body.data.limits.members).toBe(1);
      expect(response.body.data.usage).toEqual({
        templates: 1,
        approvals: 1,
        members: 1,
      });
      expect(response.body.data.at_limit).toBe(true); // At member limit (1/1)
    });

    it("should indicate when at limit", async () => {
      // Hit template limit
      for (let i = 0; i < 3; i++) {
        incrementTemplateCount(TEST_DATA_DIR, "ws-free");
      }

      const response = await request
        .get("/api/workspace/usage")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.at_limit).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await request.get("/api/workspace/usage");
      expect(response.status).toBe(401);
    });
  });

  describe("Plan Upgrade Endpoint", () => {
    it("should allow admin to upgrade workspace plan", async () => {
      const response = await request
        .patch("/api/admin/workspace/ws-free/plan")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({ plan: "pro" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe("pro");

      const workspace = getWorkspace(TEST_DATA_DIR, "ws-free");
      expect(workspace?.plan).toBe("pro");
    });

    it("should reject invalid plan", async () => {
      const response = await request
        .patch("/api/admin/workspace/ws-free/plan")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({ plan: "enterprise" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid plan");
    });

    it("should require admin role", async () => {
      const response = await request
        .patch("/api/admin/workspace/ws-free/plan")
        .set("Authorization", `Bearer ${userToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({ plan: "pro" });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("Admin only");
    });

    it("should require authentication", async () => {
      const response = await request
        .patch("/api/admin/workspace/ws-free/plan")
        .send({ plan: "pro" });

      expect(response.status).toBe(401);
    });
  });

  describe("Integration: Plan Upgrade Enables More Resources", () => {
    it("should allow creation after upgrade from free to pro", async () => {
      // Hit free tier limit
      for (let i = 0; i < 3; i++) {
        incrementTemplateCount(TEST_DATA_DIR, "ws-free");
      }

      // Try to create — should fail
      let response = await request
        .post("/api/chain-templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({
          name: "Should Fail",
          steps: [{ order: 0, requiredRole: "admin", label: "Review" }],
        });
      expect(response.status).toBe(403);

      // Upgrade plan
      await request
        .patch("/api/admin/workspace/ws-free/plan")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({ plan: "pro" });

      // Try again — should succeed
      response = await request
        .post("/api/chain-templates")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-PuddleJumper-Request", "true")
        .send({
          name: "Should Succeed",
          steps: [{ order: 0, requiredRole: "admin", label: "Review" }],
        });
      expect(response.status).toBe(201);
    });
  });
});
