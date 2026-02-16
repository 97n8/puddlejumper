import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createPRR,
  getPRRById,
  getPRRByToken,
  listPRRs,
  updatePRRStatus,
  assignPRR,
  addPRRComment,
  listPRRComments,
  deletePRR,
  initPRRTables,
} from "../src/engine/prrStore.js";

describe("PRR Store", () => {
  const dataDir = path.join(process.cwd(), "test-data-prr");
  const workspaceId = "test-workspace";

  beforeEach(() => {
    // Clean and recreate test directory
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true });
    }
    fs.mkdirSync(dataDir, { recursive: true });
    
    // Initialize tables and create test workspace
    const db = initPRRTables(dataDir);
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free'
      );
    `);
    db.prepare("INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)").run(
      workspaceId,
      "Test Workspace",
      "test-owner"
    );
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(dataDir)) {
      fs.rmSync(dataDir, { recursive: true });
    }
  });

  describe("createPRR", () => {
    it("creates a PRR with required fields", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Need parking records",
        details: "All records from 2023",
        submitter_name: "John Doe",
        submitter_email: "john@example.com",
      });

      expect(prr.id).toBeTruthy();
      expect(prr.public_token).toBeTruthy();
      expect(prr.public_token).toHaveLength(64);
      expect(prr.status).toBe("submitted");
      expect(prr.summary).toBe("Need parking records");
    });

    it("creates a PRR with minimal fields", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Request",
      });

      expect(prr.id).toBeTruthy();
      expect(prr.public_token).toBeTruthy();
      expect(prr.submitter_name).toBeNull();
      expect(prr.details).toBeNull();
    });

    it("throws on missing workspace_id", () => {
      expect(() => {
        createPRR(dataDir, { summary: "Test" } as any);
      }).toThrow();
    });

    it("throws on missing summary", () => {
      expect(() => {
        createPRR(dataDir, { workspace_id: workspaceId } as any);
      }).toThrow();
    });
  });

  describe("getPRRById", () => {
    it("retrieves a PRR by ID", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Test request",
      });

      const prr = getPRRById(dataDir, created.id);
      expect(prr).toBeTruthy();
      expect(prr?.id).toBe(created.id);
      expect(prr?.summary).toBe("Test request");
    });

    it("returns null for non-existent ID", () => {
      const prr = getPRRById(dataDir, "non-existent");
      expect(prr).toBeNull();
    });
  });

  describe("getPRRByToken", () => {
    it("retrieves a PRR by public token", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Public lookup test",
      });

      const prr = getPRRByToken(dataDir, created.public_token);
      expect(prr).toBeTruthy();
      expect(prr?.public_token).toBe(created.public_token);
    });

    it("returns null for invalid token", () => {
      const prr = getPRRByToken(dataDir, "invalid-token");
      expect(prr).toBeNull();
    });
  });

  describe("listPRRs", () => {
    beforeEach(() => {
      createPRR(dataDir, { workspace_id: workspaceId, summary: "Request 1" });
      createPRR(dataDir, { workspace_id: workspaceId, summary: "Request 2" });
      createPRR(dataDir, { workspace_id: workspaceId, summary: "Request 3" });
    });

    it("lists all PRRs for workspace", () => {
      const result = listPRRs(dataDir, { workspace_id: workspaceId });
      expect(result.requests).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("filters by status", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Acknowledged request",
      });
      updatePRRStatus(dataDir, prr.id, "acknowledged");

      const result = listPRRs(dataDir, {
        workspace_id: workspaceId,
        status: "acknowledged",
      });
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].status).toBe("acknowledged");
    });

    it("paginates results", () => {
      const result = listPRRs(dataDir, {
        workspace_id: workspaceId,
        limit: 2,
        offset: 1,
      });
      expect(result.requests).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it("returns empty for different workspace", () => {
      db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(
        "other-workspace",
        "Other"
      );

      const result = listPRRs(dataDir, { workspace_id: "other-workspace" });
      expect(result.requests).toHaveLength(0);
    });
  });

  describe("updatePRRStatus", () => {
    it("updates status", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Status test",
      });

      const updated = updatePRRStatus(dataDir, created.id, "in_progress");
      expect(updated.status).toBe("in_progress");

      const fetched = getPRRById(dataDir, created.id);
      expect(fetched?.status).toBe("in_progress");
    });

    it("updates status with comment", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Status with comment",
      });

      updatePRRStatus(
        db,
        created.id,
        "acknowledged",
        "user-123",
        "We received your request"
      );

      const comments = listPRRComments(dataDir, created.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe("We received your request");
    });

    it("throws on invalid status", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Invalid status test",
      });

      expect(() => {
        updatePRRStatus(dataDir, created.id, "invalid" as any);
      }).toThrow();
    });
  });

  describe("assignPRR", () => {
    it("assigns a PRR to user", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Assign test",
      });

      const assigned = assignPRR(dataDir, created.id, "user-456");
      expect(assigned.assigned_to).toBe("user-456");
    });

    it("unassigns when userId is null", () => {
      const created = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Unassign test",
      });

      assignPRR(dataDir, created.id, "user-789");
      const unassigned = assignPRR(dataDir, created.id, null);
      expect(unassigned.assigned_to).toBeNull();
    });
  });

  describe("comments", () => {
    it("adds a comment", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Comment test",
      });

      const comment = addPRRComment(dataDir, {
        prr_id: prr.id,
        user_id: "user-123",
        body: "Test comment",
      });

      expect(comment.id).toBeTruthy();
      expect(comment.body).toBe("Test comment");
      expect(comment.user_id).toBe("user-123");
    });

    it("adds system comment", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "System comment test",
      });

      const comment = addPRRComment(dataDir, {
        prr_id: prr.id,
        user_id: null,
        body: "Status changed",
      });

      expect(comment.user_id).toBeNull();
    });

    it("lists comments for PRR", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Multiple comments",
      });

      addPRRComment(dataDir, {
        prr_id: prr.id,
        user_id: "user-1",
        body: "First",
      });
      addPRRComment(dataDir, {
        prr_id: prr.id,
        user_id: "user-2",
        body: "Second",
      });

      const comments = listPRRComments(dataDir, prr.id);
      expect(comments).toHaveLength(2);
      expect(comments[0].body).toBe("First");
      expect(comments[1].body).toBe("Second");
    });
  });

  describe("deletePRR", () => {
    it("deletes a PRR", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Delete test",
      });

      deletePRR(dataDir, prr.id);

      const fetched = getPRRById(dataDir, prr.id);
      expect(fetched).toBeNull();
    });

    it("deletes comments when PRR deleted", () => {
      const prr = createPRR(dataDir, {
        workspace_id: workspaceId,
        summary: "Cascade delete test",
      });

      addPRRComment(dataDir, {
        prr_id: prr.id,
        user_id: "user-1",
        body: "Comment",
      });

      deletePRR(dataDir, prr.id);

      const comments = listPRRComments(dataDir, prr.id);
      expect(comments).toHaveLength(0);
    });
  });
});
