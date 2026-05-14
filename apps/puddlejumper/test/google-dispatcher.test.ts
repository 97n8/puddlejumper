import { describe, expect, it } from "vitest";
import { GoogleDriveDispatcher } from "../src/engine/dispatchers/google.js";

describe("GoogleDriveDispatcher", () => {
  const dispatcher = new GoogleDriveDispatcher();

  it("validates plans before dispatch", async () => {
    const result = await dispatcher.dispatch(
      {
        stepId: "step-1",
        description: "Bad plan",
        requiresApproval: false,
        connector: "google",
        status: "ready",
        plan: { operation: "move_file", file_id: "a" },
      },
      {
        approvalId: "approval-1",
        requestId: "request-1",
        operatorId: "operator-1",
        dryRun: true,
      },
    );

    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/Invalid input/i);
  });

  it("returns dry-run dispatched result for valid move plans", async () => {
    const result = await dispatcher.dispatch(
      {
        stepId: "step-2",
        description: "Move file",
        requiresApproval: false,
        connector: "google",
        status: "ready",
        plan: {
          operation: "move_file",
          file_id: "file-1",
          from_parent_id: "root",
          to_parent_id: "folder-1",
          preserve_name: true,
          allow_overwrite: false,
        },
      },
      {
        approvalId: "approval-1",
        requestId: "request-1",
        operatorId: "operator-1",
        dryRun: true,
      },
    );

    expect(result.status).toBe("dispatched");
    expect(result.result).toMatchObject({
      dryRun: true,
      operation: "move_file",
    });
  });

  it("skips non-noop execution until live implementation exists", async () => {
    const result = await dispatcher.dispatch(
      {
        stepId: "step-3",
        description: "Create shortcut",
        requiresApproval: false,
        connector: "google",
        status: "ready",
        plan: {
          operation: "create_shortcut",
          target_file_id: "file-1",
          destination_parent_id: "folder-1",
        },
      },
      {
        approvalId: "approval-1",
        requestId: "request-1",
        operatorId: "operator-1",
        dryRun: false,
      },
    );

    expect(result.status).toBe("skipped");
    expect(result.result).toMatchObject({
      operation: "create_shortcut",
    });
  });
});
