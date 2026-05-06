import { describe, expect, it } from "vitest";
import { decideDriveIntake } from "../src/policy/driveIntakePolicy.js";

describe("driveIntakePolicy", () => {
  it("routes legal/ip files below 0.95 to review", () => {
    const result = decideDriveIntake({
      classification: {
        category: "legal_ip",
        confidence: 0.88,
        work_state: "3_DRAFT",
      },
      policy_context: {
        legal_ip_sensitive: true,
        externally_owned: false,
      },
      proposed_plan: {
        action: "move",
        plan: { operation: "move_file" },
      },
    });

    expect(result.decision).toBe("require_review");
    expect(result.chain_template).toBe("drive_intake_review");
  });

  it("auto-executes high-confidence non-sensitive payloads", () => {
    const result = decideDriveIntake({
      classification: {
        category: "business",
        confidence: 0.96,
        work_state: "4_READY",
      },
      policy_context: {
        legal_ip_sensitive: false,
        externally_owned: false,
      },
      proposed_plan: {
        action: "move",
        plan: { operation: "move_file" },
      },
    });

    expect(result).toEqual({
      decision: "auto_execute",
      chain_template: "drive_intake_execute",
      rationale: "Confidence 0.96 ≥ 0.9, no policy flags raised.",
    });
  });

  it("preserves explicit review for low-confidence noop payloads", () => {
    const result = decideDriveIntake({
      classification: {
        category: "legal_ip",
        confidence: 0.42,
        work_state: "1_CAPTURED",
      },
      policy_context: {
        legal_ip_sensitive: false,
        externally_owned: false,
      },
      proposed_plan: {
        action: "review",
        plan: { operation: "noop" },
      },
    });

    expect(result).toEqual({
      decision: "require_review",
      chain_template: "drive_intake_review",
      rationale: "Review required: explicit_review_action",
      reasons: ["explicit_review_action"],
    });
  });
});
