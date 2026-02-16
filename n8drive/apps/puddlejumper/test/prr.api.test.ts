import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import express, { type Express } from "express";
import request from "supertest";
import { createPublicPRRRoutes } from "../src/api/routes/publicPrr.js";
import { createAdminPRRRoutes } from "../src/api/routes/prrAdmin.js";
import { createPRR } from "../src/engine/prrStore.js";

describe("PRR API", () => {
  let app: Express;
  let db: Database.Database;
  const workspaceId = "test-workspace";
  const userId = "test-user";

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");

    // Setup tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member', 'viewer'))
      );
    `);

    db.prepare("INSERT INTO workspaces (id, name) VALUES (?, ?)").run(
      workspaceId,
      "Test Workspace"
    );
    db.prepare(
      "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, ?)"
    ).run("member-1", workspaceId, userId, "admin");

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req: any, res, next) => {
      req.user = { id: userId, workspace_id: workspaceId };
      req.db = db;
      next();
    });

    app.use(createPublicPRRRoutes());
    app.use("/api", createAdminPRRRoutes());
  });

  describe("Public API", () => {
    describe("POST /public/prr", () => {
      it("creates a PRR and returns token", async () => {
        const res = await request(app)
          .post("/public/prr")
          .send({
            workspace_id: workspaceId,
            summary: "Test request",
            details: "Please provide documents",
            submitter_name: "Jane Doe",
            submitter_email: "jane@example.com",
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.public_token).toBeTruthy();
        expect(res.body.data.id).toBeTruthy();
      });

      it("creates minimal PRR", async () => {
        const res = await request(app).post("/public/prr").send({
          workspace_id: workspaceId,
          summary: "Minimal request",
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it("rejects missing workspace_id", async () => {
        const res = await request(app).post("/public/prr").send({
          summary: "Test",
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });

      it("rejects missing summary", async () => {
        const res = await request(app).post("/public/prr").send({
          workspace_id: workspaceId,
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe("GET /public/prr/:token", () => {
      it("retrieves PRR by token", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Lookup test",
          details: "Details here",
        });

        const res = await request(app).get(`/public/prr/${prr.public_token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.summary).toBe("Lookup test");
        expect(res.body.data.status).toBe("submitted");
      });

      it("returns 404 for invalid token", async () => {
        const res = await request(app).get("/public/prr/invalid-token");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });
  });

  describe("Admin API", () => {
    describe("GET /api/prr", () => {
      beforeEach(() => {
        createPRR(db, { workspace_id: workspaceId, summary: "Request 1" });
        createPRR(db, { workspace_id: workspaceId, summary: "Request 2" });
        createPRR(db, { workspace_id: workspaceId, summary: "Request 3" });
      });

      it("lists all PRRs", async () => {
        const res = await request(app).get("/api/prr");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.requests).toHaveLength(3);
        expect(res.body.data.total).toBe(3);
      });

      it("filters by status", async () => {
        const res = await request(app).get("/api/prr?status=submitted");

        expect(res.status).toBe(200);
        expect(res.body.data.requests).toHaveLength(3);
      });

      it("paginates", async () => {
        const res = await request(app).get("/api/prr?limit=2&offset=1");

        expect(res.status).toBe(200);
        expect(res.body.data.requests).toHaveLength(2);
        expect(res.body.data.total).toBe(3);
      });
    });

    describe("GET /api/prr/:id", () => {
      it("retrieves full PRR with comments", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Detail test",
        });

        const res = await request(app).get(`/api/prr/${prr.id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(prr.id);
        expect(res.body.data.comments).toEqual([]);
      });

      it("returns 404 for non-existent PRR", async () => {
        const res = await request(app).get("/api/prr/non-existent");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
      });
    });

    describe("POST /api/prr/:id/comment", () => {
      it("adds a comment", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Comment test",
        });

        const res = await request(app).post(`/api/prr/${prr.id}/comment`).send({
          body: "Test comment",
        });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.body).toBe("Test comment");
        expect(res.body.data.user_id).toBe(userId);
      });

      it("rejects empty comment", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Empty comment test",
        });

        const res = await request(app).post(`/api/prr/${prr.id}/comment`).send({
          body: "",
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe("PATCH /api/prr/:id", () => {
      it("updates status", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Update test",
        });

        const res = await request(app).patch(`/api/prr/${prr.id}`).send({
          status: "in_progress",
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("in_progress");
      });

      it("assigns PRR", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Assign test",
        });

        const res = await request(app).patch(`/api/prr/${prr.id}`).send({
          assigned_to: "other-user",
        });

        expect(res.status).toBe(200);
        expect(res.body.data.assigned_to).toBe("other-user");
      });

      it("rejects invalid status", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Invalid status",
        });

        const res = await request(app).patch(`/api/prr/${prr.id}`).send({
          status: "invalid",
        });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
      });
    });

    describe("DELETE /api/prr/:id", () => {
      it("deletes a PRR", async () => {
        const prr = createPRR(db, {
          workspace_id: workspaceId,
          summary: "Delete test",
        });

        const res = await request(app).delete(`/api/prr/${prr.id}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        const getRes = await request(app).get(`/api/prr/${prr.id}`);
        expect(getRes.status).toBe(404);
      });
    });
  });
});
