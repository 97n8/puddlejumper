import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

import type { AuthContext } from "@publiclogic/core";
import { getAuthContext as getRequestAuthContext } from "@publiclogic/core";

import {
  PJ_ACTION_DEFINITIONS,
  assertTenantScope,
  buildCapabilityManifest,
  buildPjEvaluatePayload,
  buildPjExecuteData,
  isPjActionAllowed,
  listAllowedPjActions,
  resolveDecisionStatusCode,
} from "./capabilities.js";
import type { PjExecuteRequestBody } from "./schemas.js";
import { createDefaultEngine } from "../engine/governanceEngine.js";
import type { ApprovalStore } from "../engine/approvalStore.js";
import type { ChainStore } from "../engine/chainStore.js";
import type { PolicyProvider } from "../engine/policyProvider.js";
import type { PrrStore, PrrStatus, AccessRequestStatus } from "./prrStore.js";
import type { LiveCapabilities, LiveTile, RuntimeContext } from "./types.js";
import { getWorkspace, listWorkspaceMembers, listWorkspaces, incrementApprovalCount } from "../engine/workspaceStore.js";
import { listLocalUsers } from "./localUsersStore.js";
import { listAllUsers } from "./userStore.js";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

type McpSession = {
  id: string;
  res: Response;
  auth: AuthContext;
  tenantId: string;
  userId: string;
  createdAt: number;
};

type OAuthMetadataOptions = {
  issuer: string;
  authorizationEndpoint?: string | null;
  tokenEndpoint?: string | null;
};

export type McpRouterOptions = {
  dataDir: string;
  prrStore: PrrStore;
  approvalStore: ApprovalStore;
  runtimeContext: RuntimeContext | null;
  runtimeTiles: LiveTile[];
  runtimeCapabilities: LiveCapabilities | null;
  nodeEnv: string;
  chainStore?: ChainStore;
  policyProvider?: PolicyProvider;
  getAuthContext?: (req: Request) => AuthContext | null;
  serverName?: string;
  serverVersion?: string;
};

const sessions = new Map<string, McpSession>();

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}, 5 * 60 * 1000).unref();

const EMPTY_INPUT_SCHEMA = { type: "object", properties: {} } as const;
const GENERIC_TEXT_FILTERS = {
  limit: { type: "number" },
  offset: { type: "number" },
};

const IMPLEMENTED_TOOLS: readonly McpTool[] = [
  {
    name: "prr_list",
    description: "List PRRs for the authenticated tenant using the current PJ PRR store.",
    inputSchema: {
      type: "object",
      properties: {
        ...GENERIC_TEXT_FILTERS,
        status: { type: "string" },
        assigned_to: { type: "string" },
      },
    },
  },
  {
    name: "prr_get",
    description: "Get a single PRR with its audit trail.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "prr_create",
    description: "Create a new PRR using the existing PJ intake flow.",
    inputSchema: {
      type: "object",
      required: ["subject", "requester_name", "requester_email", "body"],
      properties: {
        subject: { type: "string" },
        requester_name: { type: "string" },
        requester_email: { type: "string" },
        body: { type: "string" },
        department: { type: "string" },
      },
    },
  },
  {
    name: "prr_transition",
    description: "Transition a PRR through the statuses PJ currently supports.",
    inputSchema: {
      type: "object",
      required: ["id", "to_status"],
      properties: {
        id: { type: "string" },
        to_status: { type: "string", enum: ["received", "acknowledged", "in_progress", "extended", "closed"] },
        note: { type: "string" },
      },
    },
  },
  {
    name: "prr_close",
    description: "Close a PRR with an optional disposition.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        resolution: { type: "string" },
        note: { type: "string" },
      },
    },
  },
  {
    name: "access_request_list",
    description: "List access requests for the authenticated tenant.",
    inputSchema: {
      type: "object",
      properties: {
        ...GENERIC_TEXT_FILTERS,
        status: { type: "string" },
        requester_id: { type: "string" },
      },
    },
  },
  {
    name: "access_request_get",
    description: "Get a single access request with its audit trail and latest notification.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "access_request_create",
    description: "Create an access request using the existing PJ intake flow.",
    inputSchema: {
      type: "object",
      required: ["requester_id", "resource_type", "resource_id", "justification"],
      properties: {
        requester_id: { type: "string" },
        resource_type: { type: "string" },
        resource_id: { type: "string" },
        justification: { type: "string" },
        requested_role: { type: "string" },
        requester_name: { type: "string" },
        requester_email: { type: "string" },
        organization: { type: "string" },
      },
    },
  },
  {
    name: "access_request_approve",
    description: "Approve an access request.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, note: { type: "string" } } },
  },
  {
    name: "access_request_deny",
    description: "Deny an access request.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, reason: { type: "string" }, note: { type: "string" } } },
  },
  {
    name: "access_request_close",
    description: "Close an access request.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, resolution: { type: "string" }, note: { type: "string" } } },
  },
  {
    name: "access_request_stats",
    description: "Return access request counts by status for the current tenant.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
  {
    name: "governance_evaluate",
    description: "Evaluate a PJ action through the governance engine.",
    inputSchema: {
      type: "object",
      required: ["action_type", "payload"],
      properties: {
        action_type: { type: "string" },
        payload: { type: "object" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "action_execute",
    description: "Run the current PJ execute flow for supported actions.",
    inputSchema: {
      type: "object",
      required: ["action_type", "payload"],
      properties: {
        action_type: { type: "string" },
        payload: { type: "object" },
        dry_run: { type: "boolean" },
      },
    },
  },
  {
    name: "action_capabilities",
    description: "List PJ actions allowed for the authenticated user in the current runtime context.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
  {
    name: "org_info",
    description: "Return current workspace metadata for the authenticated tenant.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
  {
    name: "org_users_list",
    description: "List workspace users with roles and account type.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "system_health",
    description: "Return basic process and runtime health details.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
  {
    name: "system_stats",
    description: "Return available MCP session, workspace, and approval queue counts.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
  {
    name: "system_diagnostics",
    description: "Return admin-only runtime diagnostics.",
    inputSchema: EMPTY_INPUT_SCHEMA,
  },
];

const UNIMPLEMENTED_TOOLS: ReadonlyArray<[name: string, description: string, requirement: string]> = [
  ["prr_assign", "Assign a PRR to a user.", "requires store method: PrrStore.assignPrr"],
  ["prr_add_correspondence", "Append PRR correspondence.", "requires store method: PrrStore.addPrrCorrespondence"],
  ["prr_stats", "Return PRR statistics.", "requires store method: PrrStore.getPrrStats"],
  ["prr_overdue_list", "List overdue PRRs.", "requires store method: PrrStore.listOverduePrrs"],
  ["prr_search", "Search PRRs.", "requires store method: PrrStore.searchPrrs"],
  ["governance_rules_list", "List governance rules.", "requires store method: PolicyProvider.listRules"],
  ["governance_rule_get", "Get one governance rule.", "requires store method: PolicyProvider.getRule"],
  ["governance_rule_create", "Create a governance rule.", "requires store method: PolicyProvider.createRule"],
  ["governance_rule_update", "Update a governance rule.", "requires store method: PolicyProvider.updateRule"],
  ["governance_rule_disable", "Disable a governance rule.", "requires store method: PolicyProvider.disableRule"],
  ["governance_simulate", "Simulate a governance decision trace.", "requires store method: PolicyProvider.simulateRuleEvaluation"],
  ["action_list", "List executed actions.", "requires store method: ApprovalStore.listActionEvents"],
  ["action_get", "Get a single executed action.", "requires store method: ApprovalStore.getActionEvent"],
  ["action_retry", "Retry a failed executed action.", "requires store method: ApprovalStore.retryActionEvent"],
  ["audit_search", "Search audit events.", "requires store method: PolicyProvider.searchAuditEvents"],
  ["audit_get_entity_history", "Get full audit history for one entity.", "requires store method: PolicyProvider.getAuditEntityHistory"],
  ["audit_actor_summary", "Summarize audit activity for an actor.", "requires store method: PolicyProvider.getAuditActorSummary"],
  ["audit_export", "Export audit events.", "requires store method: PolicyProvider.exportAuditEvents"],
  ["procurement_list", "List procurement records.", "requires store method: FinanceStore.listProcurementRecords"],
  ["procurement_get", "Get a procurement record.", "requires store method: FinanceStore.getProcurementRecord"],
  ["procurement_create", "Create a procurement record.", "requires store method: FinanceStore.createProcurementRecord"],
  ["procurement_threshold_check", "Check procurement threshold requirements.", "requires store method: FinanceStore.getProcurementThresholdCheck"],
  ["procurement_add_vendor", "Add a vendor to a procurement.", "requires store method: FinanceStore.addProcurementVendor"],
  ["procurement_award", "Award a procurement.", "requires store method: FinanceStore.awardProcurement"],
  ["procurement_timeline", "Return procurement timeline details.", "requires store method: FinanceStore.getProcurementTimeline"],
  ["budget_summary", "Return budget summary information.", "requires store method: FinanceStore.getBudgetSummary"],
  ["budget_transfer_evaluate", "Evaluate a budget transfer.", "requires store method: FinanceStore.evaluateBudgetTransfer"],
  ["budget_line_get", "Get one budget line.", "requires store method: FinanceStore.getBudgetLine"],
  ["budget_encumbrance_create", "Create a budget encumbrance.", "requires store method: FinanceStore.createBudgetEncumbrance"],
  ["budget_report", "Return a budget report.", "requires store method: FinanceStore.getBudgetReport"],
  ["personnel_list", "List personnel records.", "requires store method: OrgStore.listPersonnel"],
  ["personnel_get", "Get one personnel record.", "requires store method: OrgStore.getPersonnelRecord"],
  ["personnel_position_create", "Create a position record.", "requires store method: OrgStore.createPersonnelPosition"],
  ["personnel_appointment_log", "Log a personnel appointment action.", "requires store method: OrgStore.logPersonnelAppointment"],
  ["open_meeting_check", "Evaluate open meeting requirements.", "requires store method: GovernanceService.checkOpenMeeting"],
  ["retention_schedule_get", "Get one retention schedule.", "requires store method: ArchieveStore.getRetentionSchedule"],
  ["retention_schedule_list", "List retention schedules.", "requires store method: ArchieveStore.listRetentionSchedules"],
  ["retention_flag_record", "Flag a record for retention review.", "requires store method: ArchieveStore.flagRetentionRecord"],
  ["retention_due_list", "List records due for retention review.", "requires store method: ArchieveStore.listRetentionDueRecords"],
  ["connector_list", "List connectors.", "requires store method: ConnectorStore.listConnectors"],
  ["connector_get", "Get one connector.", "requires store method: ConnectorStore.getConnector"],
  ["connector_trigger_sync", "Trigger a connector sync.", "requires store method: ConnectorStore.triggerSync"],
  ["connector_sync_status", "Get connector sync status.", "requires store method: ConnectorStore.getSyncStatus"],
  ["connector_test", "Test a connector.", "requires store method: ConnectorStore.testConnector"],
  ["org_modules_list", "List module activation status.", "requires store method: WorkspaceConfigStore.listModules"],
  ["org_module_toggle", "Toggle a module.", "requires store method: WorkspaceConfigStore.toggleModule"],
  ["org_user_get", "Get one workspace user.", "requires store method: WorkspaceUserStore.getUser"],
  ["org_user_invite", "Invite a workspace user.", "requires store method: WorkspaceInvitationStore.createInvitation"],
  ["org_user_role_update", "Update a workspace role through governance.", "requires store method: WorkspaceUserStore.updateRoleGoverned"],
  ["org_user_deactivate", "Deactivate a workspace user.", "requires store method: WorkspaceUserStore.deactivateUser"],
  ["workspace_config_get", "Return workspace configuration.", "requires store method: WorkspaceConfigStore.getConfig"],
  ["workspace_config_update", "Update workspace configuration.", "requires store method: WorkspaceConfigStore.updateConfig"],
  ["synchron8_flow_list", "List SYNCHRON8 flows.", "requires store method: SyncronateStore.listFlows"],
  ["synchron8_flow_trigger", "Trigger a SYNCHRON8 flow.", "requires store method: SyncronateStore.triggerFlow"],
  ["synchron8_flow_run_status", "Get SYNCHRON8 flow status.", "requires store method: SyncronateStore.getFlowRunStatus"],
  ["synchron8_run_history", "List SYNCHRON8 run history.", "requires store method: SyncronateStore.listRunHistory"],
];

const TOOL_DEFINITIONS: readonly McpTool[] = [
  ...IMPLEMENTED_TOOLS,
  ...UNIMPLEMENTED_TOOLS.map(([name, description]) => ({ name, description, inputSchema: EMPTY_INPUT_SCHEMA })),
];

function jsonrpcOk(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonrpcErr(id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function sendSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function normalizeAuth(auth: AuthContext | null): { auth: AuthContext; tenantId: string; userId: string } | null {
  if (!auth) return null;
  const tenantId = typeof auth.tenantId === "string" && auth.tenantId.trim()
    ? auth.tenantId.trim()
    : typeof auth.workspaceId === "string" && auth.workspaceId.trim()
      ? auth.workspaceId.trim()
      : "";
  const userId = typeof auth.userId === "string" && auth.userId.trim()
    ? auth.userId.trim()
    : typeof auth.sub === "string" && auth.sub.trim()
      ? auth.sub.trim()
      : "";
  if (!tenantId || !userId) return null;
  return { auth, tenantId, userId };
}

function getSessionAuth(req: Request, customExtractor?: (req: Request) => AuthContext | null) {
  return normalizeAuth(customExtractor ? customExtractor(req) : getRequestAuthContext(req));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

function requireAdmin(session: McpSession): void {
  if (session.auth.role !== "admin") {
    throw { code: -32003, message: "Admin role required" };
  }
}

function parseAuditMetadata(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function evaluateAction(
  opts: McpRouterOptions,
  session: McpSession,
  params: Record<string, unknown>,
) {
  if (!opts.runtimeContext) {
    throw { code: -32003, message: "Runtime context unavailable" };
  }

  const actionId = asString(params.action_type);
  if (!actionId) throw { code: -32602, message: "action_type is required" };

  const action = PJ_ACTION_DEFINITIONS.find((entry) => entry.id === actionId);
  if (!action) {
    throw { code: -32602, message: `Unsupported action_type: ${actionId}` };
  }

  const manifest = buildCapabilityManifest(session.auth, opts.runtimeTiles, opts.runtimeCapabilities);
  if (!isPjActionAllowed(manifest, action)) {
    throw { code: -32003, message: "Action is not permitted for this user" };
  }

  const request = {
    actionId: action.id,
    payload: asObject(params.payload),
    mode: asBool(params.dry_run) ? "dry-run" : "execute",
  } as PjExecuteRequestBody;

  const evaluatePayload = buildPjEvaluatePayload(
    session.auth,
    opts.runtimeContext,
    request,
    randomUUID(),
  );

  const tenantScope = assertTenantScope(session.auth, evaluatePayload);
  if (!tenantScope.ok) {
    throw { code: -32003, message: tenantScope.reason, data: tenantScope.details };
  }

  const engine = createDefaultEngine({
    policyProvider: opts.policyProvider,
  });
  const result = await engine.evaluate(evaluatePayload);

  return { action, request, evaluatePayload, result, manifest };
}

async function handleToolCall(
  toolName: string,
  params: Record<string, unknown>,
  session: McpSession,
  opts: McpRouterOptions,
): Promise<unknown> {
  const requirement = UNIMPLEMENTED_TOOLS.find(([name]) => name === toolName)?.[2];
  if (requirement) {
    throw { code: -32004, message: "Tool not implemented", data: { tool: toolName, requirement } };
  }

  switch (toolName) {
    case "prr_list": {
      const result = opts.prrStore.listDetailedForTenant({
        tenantId: session.tenantId,
        status: (asString(params.status) as PrrStatus | null) ?? undefined,
        assignedTo: asString(params.assigned_to) ?? undefined,
        limit: boundedInt(params.limit, 25, 1, 100),
        offset: boundedInt(params.offset, 0, 0, 10_000),
      });
      return result;
    }
    case "prr_get": {
      const id = asString(params.id);
      if (!id) throw { code: -32602, message: "id is required" };
      const prr = opts.prrStore.getRecordForTenant(id, session.tenantId);
      if (!prr) throw { code: -32001, message: "PRR not found" };
      const auditTrail = opts.prrStore.getPrrAuditTrail(id, session.tenantId).map((row) => ({
        ...row,
        metadata: parseAuditMetadata(row.metadata),
      }));
      return { prr, audit_trail: auditTrail };
    }
    case "prr_create": {
      const subject = asString(params.subject);
      const requesterName = asString(params.requester_name);
      const requesterEmail = asString(params.requester_email);
      const body = asString(params.body);
      if (!subject || !requesterName || !requesterEmail || !body) {
        throw { code: -32602, message: "subject, requester_name, requester_email, and body are required" };
      }
      return opts.prrStore.intake({
        tenantId: session.tenantId,
        requesterName,
        requesterEmail,
        subject,
        description: body,
        actorUserId: session.userId,
        metadata: { department: asString(params.department), source: "mcp.prr_create" },
      });
    }
    case "prr_transition": {
      const id = asString(params.id);
      const toStatus = asString(params.to_status) as PrrStatus | null;
      if (!id || !toStatus) throw { code: -32602, message: "id and to_status are required" };
      if (toStatus === "closed") {
        const closed = opts.prrStore.closeCase({
          id,
          tenantId: session.tenantId,
          actorUserId: session.userId,
          disposition: asString(params.note),
          metadata: { source: "mcp.prr_transition", note: asString(params.note) },
        });
        if (!closed.ok) throw { code: closed.code === "not_found" ? -32001 : -32002, message: "Unable to close PRR", data: closed };
        return closed.row;
      }
      const transition = opts.prrStore.transitionStatus({
        id,
        tenantId: session.tenantId,
        toStatus,
        actorUserId: session.userId,
        metadata: { note: asString(params.note), source: "mcp.prr_transition" },
      });
      if (!transition.ok) {
        throw { code: transition.code === "not_found" ? -32001 : -32002, message: "Invalid PRR transition", data: transition };
      }
      return transition.row;
    }
    case "prr_close": {
      const id = asString(params.id);
      if (!id) throw { code: -32602, message: "id is required" };
      const closed = opts.prrStore.closeCase({
        id,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        disposition: asString(params.resolution),
        metadata: { note: asString(params.note), source: "mcp.prr_close" },
      });
      if (!closed.ok) {
        throw { code: closed.code === "not_found" ? -32001 : -32002, message: "Unable to close PRR", data: closed };
      }
      return closed.row;
    }
    case "access_request_list": {
      return opts.prrStore.listAccessRequestsForTenant({
        tenantId: session.tenantId,
        status: (asString(params.status) as AccessRequestStatus | null) ?? undefined,
        requesterId: asString(params.requester_id) ?? undefined,
        limit: boundedInt(params.limit, 25, 1, 100),
        offset: boundedInt(params.offset, 0, 0, 10_000),
      });
    }
    case "access_request_get": {
      const id = asString(params.id);
      if (!id) throw { code: -32602, message: "id is required" };
      const accessRequest = opts.prrStore.getAccessRequestForTenant(id, session.tenantId);
      if (!accessRequest) throw { code: -32001, message: "Access request not found" };
      const auditTrail = opts.prrStore.getAccessRequestAuditTrail(id, session.tenantId).map((row) => ({
        ...row,
        metadata: parseAuditMetadata(row.metadata),
      }));
      return {
        access_request: accessRequest,
        audit_trail: auditTrail,
        latest_notification: opts.prrStore.getLatestAccessRequestNotification(id),
      };
    }
    case "access_request_create": {
      const justification = asString(params.justification);
      if (!justification) throw { code: -32602, message: "justification is required" };
      return opts.prrStore.intakeAccessRequest({
        tenantId: session.tenantId,
        requesterName: asString(params.requester_name),
        requesterEmail: asString(params.requester_email) ?? `${session.userId}@example.invalid`,
        organization: asString(params.organization),
        requestedRole: asString(params.requested_role) ?? "member",
        system: `${asString(params.resource_type) ?? "workspace"}:${asString(params.resource_id) ?? "unknown"}`,
        justification,
        actorUserId: asString(params.requester_id) ?? session.userId,
        source: "mcp.access_request_create",
      });
    }
    case "access_request_approve":
    case "access_request_deny": {
      const id = asString(params.id);
      if (!id) throw { code: -32602, message: "id is required" };
      const toStatus: AccessRequestStatus = toolName === "access_request_approve" ? "approved" : "denied";
      const transition = opts.prrStore.transitionAccessRequestStatus({
        id,
        tenantId: session.tenantId,
        toStatus,
        actorUserId: session.userId,
        metadata: { note: asString(params.note), reason: asString(params.reason), source: `mcp.${toolName}` },
      });
      if (!transition.ok) {
        throw { code: transition.code === "not_found" ? -32001 : -32002, message: "Invalid access-request transition", data: transition };
      }
      return transition.row;
    }
    case "access_request_close": {
      const id = asString(params.id);
      if (!id) throw { code: -32602, message: "id is required" };
      const closed = opts.prrStore.closeAccessRequest({
        id,
        tenantId: session.tenantId,
        actorUserId: session.userId,
        resolution: asString(params.resolution),
        metadata: { note: asString(params.note), source: "mcp.access_request_close" },
      });
      if (!closed.ok) {
        throw { code: closed.code === "not_found" ? -32001 : -32002, message: "Unable to close access request", data: closed };
      }
      return closed.row;
    }
    case "access_request_stats":
      return opts.prrStore.getAccessRequestStats(session.tenantId);
    case "governance_evaluate": {
      const evaluation = await evaluateAction(opts, session, params);
      return {
        action_id: evaluation.action.id,
        approved: evaluation.result.approved,
        warnings: evaluation.result.warnings,
        decision: evaluation.result.approved ? "APPROVE" : "DENY",
        audit_record: evaluation.result.auditRecord,
        action_plan: evaluation.result.actionPlan,
      };
    }
    case "action_execute": {
      const evaluation = await evaluateAction(opts, session, params);
      const statusCode = resolveDecisionStatusCode(evaluation.result);
      const success = statusCode === 200 && evaluation.result.approved;
      const requestMode = evaluation.request.mode;

      if (!success || requestMode === "dry-run") {
        return {
          success,
          mode: requestMode,
          action_id: evaluation.action.id,
          status_code: statusCode,
          warnings: evaluation.result.warnings,
          data: buildPjExecuteData(evaluation.request, evaluation.evaluatePayload, evaluation.result),
        };
      }

      if (opts.approvalStore && evaluation.evaluatePayload.action.mode === "governed") {
        const approval = opts.approvalStore.create({
          requestId: evaluation.evaluatePayload.action.requestId ?? `mcp-${randomUUID()}`,
          operatorId: session.userId,
          workspaceId: evaluation.evaluatePayload.workspace.id,
          municipalityId: evaluation.evaluatePayload.municipality.id,
          actionIntent: evaluation.evaluatePayload.action.intent,
          actionMode: evaluation.evaluatePayload.action.mode,
          planHash: evaluation.result.auditRecord.planHash,
          planSteps: evaluation.result.actionPlan,
          auditRecord: evaluation.result.auditRecord,
          decisionResult: evaluation.result,
        });
        try {
          incrementApprovalCount(opts.dataDir, evaluation.evaluatePayload.workspace.id);
        } catch {
          // Keep MCP execution non-fatal when workspace counters are unavailable.
        }

        return {
          success: true,
          approvalRequired: true,
          approvalId: approval.id,
          approvalStatus: approval.approval_status,
          warnings: evaluation.result.warnings,
          data: buildPjExecuteData(evaluation.request, evaluation.evaluatePayload, evaluation.result),
        };
      }

      return {
        success: true,
        approvalRequired: false,
        warnings: evaluation.result.warnings,
        data: buildPjExecuteData(evaluation.request, evaluation.evaluatePayload, evaluation.result),
      };
    }
    case "action_capabilities": {
      const manifest = buildCapabilityManifest(session.auth, opts.runtimeTiles, opts.runtimeCapabilities);
      return {
        manifest,
        actions: listAllowedPjActions(manifest),
      };
    }
    case "org_info": {
      const workspaceId = typeof session.auth.workspaceId === "string" && session.auth.workspaceId
        ? session.auth.workspaceId
        : session.tenantId;
      const workspace = getWorkspace(opts.dataDir, workspaceId);
      return {
        id: workspace?.id ?? workspaceId,
        name: workspace?.name ?? session.tenantId,
        slug: (workspace?.name ?? workspaceId).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        tier: workspace?.plan ?? "unknown",
        member_count: workspace?.member_count ?? null,
        approval_count: workspace?.approval_count ?? null,
        modules_active: [],
      };
    }
    case "org_users_list": {
      const workspaceId = typeof session.auth.workspaceId === "string" && session.auth.workspaceId
        ? session.auth.workspaceId
        : session.tenantId;
      const roleFilter = asString(params.role);
      const localUsers = new Map(listLocalUsers(opts.dataDir).map((user) => [user.id, user]));
      const oauthUsers = new Map(listAllUsers(opts.dataDir).map((user) => [user.sub, user]));
      const users = listWorkspaceMembers(opts.dataDir, workspaceId)
        .map((member) => member as {
          user_id: string;
          role: string;
          tool_access: string | null;
          joined_at: string;
        })
        .map((member) => {
          const local = localUsers.get(member.user_id);
          const oauth = oauthUsers.get(member.user_id);
          return {
            user_id: member.user_id,
            role: member.role,
            joined_at: member.joined_at,
            tool_access: member.tool_access ? JSON.parse(member.tool_access) : null,
            name: local?.name ?? oauth?.name ?? null,
            email: local?.email ?? oauth?.email ?? null,
            account_type: local ? "local" : "oauth",
            provider: oauth?.provider ?? null,
          };
        })
        .filter((user) => !roleFilter || user.role === roleFilter);
      return { users, total: users.length };
    }
    case "system_health":
      return {
        status: "ok",
        uptime_seconds: Math.floor(process.uptime()),
        version: opts.serverVersion ?? process.env.npm_package_version ?? "1.0.0",
        env: opts.nodeEnv,
        active_sessions: sessions.size,
      };
    case "system_stats":
      return {
        active_sessions: sessions.size,
        workspaces_total: listWorkspaces(opts.dataDir).length,
        approvals_pending: opts.approvalStore.countPending(),
        available_actions: PJ_ACTION_DEFINITIONS.length,
      };
    case "system_diagnostics":
      requireAdmin(session);
      return {
        uptime_seconds: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
        active_sessions: sessions.size,
        workspaces_total: listWorkspaces(opts.dataDir).length,
        approvals_pending: opts.approvalStore.countPending(),
      };
    default:
      throw { code: -32601, message: `Tool not found: ${toolName}` };
  }
}

async function dispatch(
  rpc: JsonRpcRequest,
  session: McpSession,
  opts: McpRouterOptions,
): Promise<JsonRpcResponse | null> {
  const id = rpc.id ?? null;

  switch (rpc.method) {
    case "initialize":
      return jsonrpcOk(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: opts.serverName ?? "PuddleJumper",
          version: opts.serverVersion ?? process.env.npm_package_version ?? "1.0.0",
        },
      });
    case "notifications/initialized":
      return null;
    case "tools/list":
      return jsonrpcOk(id, { tools: TOOL_DEFINITIONS });
    case "tools/call": {
      const params = asObject(rpc.params);
      const toolName = asString(params.name);
      if (!toolName) {
        return jsonrpcErr(id, -32602, "Tool name is required");
      }
      try {
        const result = await handleToolCall(toolName, asObject(params.arguments), session, opts);
        return jsonrpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (error) {
        const err = error as { code?: number; message?: string; data?: unknown };
        return jsonrpcErr(id, err.code ?? -32000, err.message ?? "Tool execution failed", err.data);
      }
    }
    default:
      return jsonrpcErr(id, -32601, `Method not found: ${rpc.method}`);
  }
}

export function oauthMetadata(options: OAuthMetadataOptions): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    issuer: options.issuer,
  };
  if (options.authorizationEndpoint) metadata.authorization_endpoint = options.authorizationEndpoint;
  if (options.tokenEndpoint) metadata.token_endpoint = options.tokenEndpoint;
  return metadata;
}

export function createMcpRouter(opts: McpRouterOptions): Router {
  const router = Router();

  router.get("/sse", (req, res) => {
    const auth = getSessionAuth(req, opts.getAuthContext);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const session: McpSession = {
      id: randomUUID(),
      res,
      auth: auth.auth,
      tenantId: auth.tenantId,
      userId: auth.userId,
      createdAt: Date.now(),
    };
    sessions.set(session.id, session);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const forwardedHost = typeof req.headers["x-forwarded-host"] === "string"
      ? req.headers["x-forwarded-host"]
      : req.hostname;
    const forwardedProto = typeof req.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"]
      : req.protocol;
    sendSse(res, "endpoint", `${forwardedProto}://${forwardedHost}/mcp/messages?sid=${session.id}`);

    const keepalive = setInterval(() => {
      res.write(": ping\n\n");
    }, 20_000);

    req.on("close", () => {
      clearInterval(keepalive);
      sessions.delete(session.id);
    });
  });

  router.post("/messages", async (req, res) => {
    const sid = asString(req.query.sid);
    if (!sid) {
      res.status(400).json({ error: "Missing sid query param" });
      return;
    }

    const session = sessions.get(sid);
    if (!session) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    const rpc = req.body as JsonRpcRequest;
    if (!rpc || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string") {
      res.status(400).json({ error: "Invalid JSON-RPC request" });
      return;
    }

    const response = await dispatch(rpc, session, opts);
    if (response && rpc.id !== undefined) {
      sendSse(session.res, "message", response);
    }
    res.status(202).end();
  });

  return router;
}
