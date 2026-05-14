export interface DriveIntakePolicyInput {
  classification: {
    category: string;
    confidence: number;
    work_state: string | null;
  };
  policy_context: {
    legal_ip_sensitive: boolean;
    externally_owned: boolean;
  };
  proposed_plan: {
    action: "move" | "shortcut" | "noop" | "review";
    plan: { operation: string };
  };
};

export type ReviewReason =
  | "legal_ip_below_threshold"
  | "externally_owned"
  | "archive_without_lock_signal"
  | "confidence_in_review_band"
  | "explicit_review_action";

export type DriveIntakePolicyDecision =
  | {
      decision: "auto_execute";
      chain_template: "drive_intake_execute";
      rationale: string;
    }
  | {
      decision: "require_review";
      chain_template: "drive_intake_review";
      rationale: string;
      reasons: ReviewReason[];
    }
  | {
      decision: "reject";
      rationale: string;
    };

export interface DriveIntakeThresholds {
  auto_execute_min: number;
  legal_ip_auto_execute_min: number;
  review_band_min: number;
}

export const DEFAULT_DRIVE_INTAKE_THRESHOLDS: DriveIntakeThresholds = {
  auto_execute_min: 0.9,
  legal_ip_auto_execute_min: 0.95,
  review_band_min: 0.7,
};

export function decideDriveIntake(
  input: DriveIntakePolicyInput,
  thresholds: DriveIntakeThresholds = DEFAULT_DRIVE_INTAKE_THRESHOLDS,
): DriveIntakePolicyDecision {
  const reasons: ReviewReason[] = [];
  const explicitReview = input.proposed_plan.action === "review";

  if (input.classification.confidence < thresholds.review_band_min) {
    if (explicitReview) {
      return {
        decision: "require_review",
        chain_template: "drive_intake_review",
        rationale: "Review required: explicit_review_action",
        reasons: ["explicit_review_action"],
      };
    }
    if (input.proposed_plan.plan.operation !== "noop") {
      return {
        decision: "reject",
        rationale: `Confidence ${input.classification.confidence.toFixed(2)} below review band (${thresholds.review_band_min}) for non-noop plan.`,
      };
    }
    return {
      decision: "auto_execute",
      chain_template: "drive_intake_execute",
      rationale: "Noop plan; nothing to govern but audit row preserved.",
    };
  }

  if (input.policy_context.externally_owned) {
    reasons.push("externally_owned");
  }

  if (
    input.policy_context.legal_ip_sensitive &&
    input.classification.confidence < thresholds.legal_ip_auto_execute_min
  ) {
    reasons.push("legal_ip_below_threshold");
  }

  if (
    input.classification.category === "publiclogic_archive" &&
    input.classification.work_state !== "5_LOCK"
  ) {
    reasons.push("archive_without_lock_signal");
  }

  if (input.classification.confidence < thresholds.auto_execute_min) {
    reasons.push("confidence_in_review_band");
  }

  if (explicitReview) {
    reasons.push("explicit_review_action");
  }

  if (reasons.length > 0) {
    return {
      decision: "require_review",
      chain_template: "drive_intake_review",
      rationale: `Review required: ${reasons.join(", ")}`,
      reasons,
    };
  }

  return {
    decision: "auto_execute",
    chain_template: "drive_intake_execute",
    rationale: `Confidence ${input.classification.confidence.toFixed(2)} ≥ ${thresholds.auto_execute_min}, no policy flags raised.`,
  };
}
