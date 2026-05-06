import type {
  ConnectorDispatcher,
  DispatchContext,
  DispatchStepResult,
  PlanStepInput,
} from "../dispatch.js";
import { validateGoogleDrivePlan } from "./googleDrivePlan.js";

export class GoogleDriveDispatcher implements ConnectorDispatcher {
  readonly connectorName = "google" as const;

  async dispatch(step: PlanStepInput, context: DispatchContext): Promise<DispatchStepResult> {
    let plan;
    try {
      plan = validateGoogleDrivePlan(step.plan);
    } catch (error) {
      return {
        stepId: step.stepId,
        connector: this.connectorName,
        status: "failed",
        error: error instanceof Error ? error.message : "Invalid Google Drive plan",
        completedAt: new Date().toISOString(),
      };
    }

    if (plan.operation === "noop") {
      return {
        stepId: step.stepId,
        connector: this.connectorName,
        status: "dispatched",
        result: {
          operation: plan.operation,
          reason: plan.reason,
          dryRun: context.dryRun,
        },
        completedAt: new Date().toISOString(),
      };
    }

    if (context.dryRun) {
      return {
        stepId: step.stepId,
        connector: this.connectorName,
        status: "dispatched",
        result: {
          dryRun: true,
          operation: plan.operation,
          plan,
          message: "Dry run — Google Drive mutation not executed",
        },
        completedAt: new Date().toISOString(),
      };
    }

    return {
      stepId: step.stepId,
      connector: this.connectorName,
      status: "skipped",
      result: {
        operation: plan.operation,
        reason: "Google Drive dispatcher not yet implemented",
      },
      completedAt: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; detail?: string }> {
    return {
      healthy: true,
      detail: "stub — plan validation and dry-run only",
    };
  }
}
