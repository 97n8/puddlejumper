// ── SharePoint Dispatcher (stub) ────────────────────────────────────────────
//
// Stub dispatcher for SharePoint Online via Microsoft Graph API.
//
// When wired:
//   • Upload files to document libraries
//   • Create/update list items
//   • Manage site pages
//
// Not yet implemented — requires a registered Azure AD app with
// Sites.ReadWrite.All or equivalent. This stub proves the registry
// pattern supports the connector and provides a health check.
//
import type {
  ConnectorDispatcher,
  PlanStepInput,
  DispatchContext,
  DispatchStepResult,
} from "../dispatch.js";

export class SharePointDispatcher implements ConnectorDispatcher {
  readonly connectorName = "sharepoint" as const;

  async dispatch(
    step: PlanStepInput,
    context: DispatchContext,
  ): Promise<DispatchStepResult> {
    const plan = step.plan as Record<string, unknown>;

    if (context.dryRun) {
      return {
        stepId: step.stepId,
        connector: this.connectorName,
        status: "dispatched",
        result: {
          dryRun: true,
          operation: plan.operation ?? "unknown",
          siteUrl: plan.siteUrl ?? null,
          message: "Dry run — no SharePoint call made",
        },
        completedAt: new Date().toISOString(),
      };
    }

    // Stub — real implementation will call Microsoft Graph
    return {
      stepId: step.stepId,
      connector: this.connectorName,
      status: "skipped",
      result: {
        reason: "SharePoint dispatcher not yet implemented",
        operation: plan.operation ?? "unknown",
      },
      completedAt: new Date().toISOString(),
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; detail?: string }> {
    // Future: validate SHAREPOINT_CLIENT_ID + SHAREPOINT_CLIENT_SECRET exist
    // and exchange for an access token.
    return {
      healthy: true,
      detail: "stub — no real SharePoint connection",
    };
  }
}
