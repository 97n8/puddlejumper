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

  it("flags externally_owned files for review", () => {
    const result = decideDriveIntake({
      classification: { category: "business", confidence: 0.97, work_state: "4_READY" },
      policy_context: { legal_ip_sensitive: false, externally_owned: true },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("require_review");
    if (result.decision === "require_review") {
      expect(result.reasons).toContain("externally_owned");
    }
  });

  it("flags publiclogic_archive without 5_LOCK as archive_without_lock_signal", () => {
    const result = decideDriveIntake({
      classification: { category: "publiclogic_archive", confidence: 0.97, work_state: "3_DRAFT" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("require_review");
    if (result.decision === "require_review") {
      expect(result.reasons).toContain("archive_without_lock_signal");
    }
  });

  it("does not flag publiclogic_archive when work_state is 5_LOCK", () => {
    const result = decideDriveIntake({
      classification: { category: "publiclogic_archive", confidence: 0.97, work_state: "5_LOCK" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("auto_execute");
  });

  it("rejects non-noop plans strictly below 0.70 confidence", () => {
    const result = decideDriveIntake({
      classification: { category: "business", confidence: 0.69, work_state: "3_DRAFT" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("reject");
  });

  it("requires review at the 0.70 boundary (review band entry)", () => {
    const result = decideDriveIntake({
      classification: { category: "business", confidence: 0.7, work_state: "3_DRAFT" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("require_review");
    if (result.decision === "require_review") {
      expect(result.reasons).toContain("confidence_in_review_band");
    }
  });

  it("requires review at 0.89 (just below auto-execute floor)", () => {
    const result = decideDriveIntake({
      classification: { category: "business", confidence: 0.89, work_state: "4_READY" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("require_review");
  });

  it("auto-executes at exactly 0.90 for non-sensitive files", () => {
    const result = decideDriveIntake({
      classification: { category: "business", confidence: 0.9, work_state: "4_READY" },
      policy_context: { legal_ip_sensitive: false, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("auto_execute");
  });

  it("requires review for legal_ip at 0.94 (below 0.95 stricter floor)", () => {
    const result = decideDriveIntake({
      classification: { category: "legal_ip", confidence: 0.94, work_state: "3_DRAFT" },
      policy_context: { legal_ip_sensitive: true, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("require_review");
    if (result.decision === "require_review") {
      expect(result.reasons).toContain("legal_ip_below_threshold");
    }
  });

  it("auto-executes legal_ip at exactly 0.95", () => {
    const result = decideDriveIntake({
      classification: { category: "legal_ip", confidence: 0.95, work_state: "4_READY" },
      policy_context: { legal_ip_sensitive: true, externally_owned: false },
      proposed_plan: { action: "move", plan: { operation: "move_file" } },
    });
    expect(result.decision).toBe("auto_execute");
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
