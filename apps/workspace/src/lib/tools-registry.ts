// ── Tools Registry ──────────────────────────────────────────────────────────
//
// Canonical list of all tools available in Workspace.
// Used by:
//   - AccessGate.tsx  — human-readable labels when access is denied
//   - AdminPanel      — tool assignment UI (which tools to grant per member)
//   - PJ backend      — validates tool IDs in requireToolAccess middleware
//
// Each tool's *internal* permissions (e.g. editor vs viewer inside Vault)
// are managed by the tool itself via /api/workspace/members/:id/tool-permissions/:toolId.
// Workspace never renders or manages those internal permissions.

export type ToolId =
  | 'vault'
  | 'automations'
  | 'logicbridge'
  | 'builder'
  | 'casespaces'
  | 'admin'
  | 'settings'
  | 'audit'
  | 'syncronate'
  | 'formkey'
  | 'logicdash'
  | 'intake'
  | 'orgmanager'
  | 'watchlayer'
  | 'budgeting'
  | 'records'
  | 'routingengine'
  | 'procurement'
  | 'evidence'
  | 'govai'
  | 'clerk'
  | 'fix'
  | 'onboard'
  | 'comms'
  | 'time'
  | 'boardcompliance'
  | 'capital'          // replaces grantsworkflow + capitalprojects
  | 'permitting'
  | 'staffhr'
  | 'townfinder'
  | 'puddles'
  | 'stay'             // hospitality & short-term rental management

export interface ToolDefinition {
  id: ToolId
  label: string
  description: string
  /** Providers this tool can request access to via connector proxy. */
  usesConnectors?: Array<'github' | 'microsoft' | 'google'>
  /** If true, only owner/admin can access — never shown in member tool assignment. */
  adminOnly?: boolean
}

export const TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: 'vault',
    label: 'Vault',
    description: 'Governed record storage — documents, cases, retention, and audit trail in one workspace.',
    usesConnectors: ['microsoft', 'google'],
  },
  {
    id: 'automations',
    label: 'Flows',
    description: 'Set up steps that run on their own so routine work happens automatically',
    usesConnectors: ['github', 'microsoft', 'google'],
  },
  {
    id: 'logicbridge',
    label: 'LogicBridge',
    description: 'Build, sandbox, and publish governed connectors to any legacy system, CRM, or vendor API',
    adminOnly: true,
  },
  {
    id: 'builder',
    label: 'Module Builder',
    description: 'Design custom intake modules and page layouts',
    adminOnly: true,
  },
  {
    id: 'casespaces',
    label: 'Environments',
    description: 'Governed workspaces — cases, apps, and automations organized by department or domain',
  },
  {
    id: 'logicdash',
    label: 'Ops Dashboard',
    description: 'Live status, risk flags, deadline proximity, and board-ready operational views',
  },
  // ── Admin-only tools ────────────────────────────────────────────────────
  {
    id: 'admin',
    label: 'Admin',
    description: 'Manage members, assign tools, and configure your workspace',
    adminOnly: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Appearance, connections, and account preferences',
    adminOnly: true,
  },
  {
    id: 'audit',
    label: 'Audit Log',
    description: 'A full record of every action taken in your workspace',
    adminOnly: true,
  },
  {
    id: 'syncronate',
    label: 'Syncronate',
    description: 'Connect and sync data across your platforms — compliantly',
    adminOnly: true,
  },
  {
    id: 'formkey',
    label: 'FormKey',
    description: 'Public forms lifecycle — build, publish, intake, and review in one governed workspace',
    adminOnly: true,
  },
  {
    id: 'intake',
    label: 'Public Intake',
    description: 'Intake inbox — normalize and route all incoming channels into governed records with full audit trail',
  },
  {
    id: 'orgmanager',
    label: 'Org Manager',
    description: 'Authority map — organizational structure, positions, routing chains, and delegations',
    adminOnly: true,
  },
  {
    id: 'watchlayer',
    label: 'Pattern Detection',
    description: 'Cross-case trend analysis, anomaly flags, and compliance gap recommendations — advisory only',
    adminOnly: true,
  },
  {
    id: 'budgeting',
    label: 'Spending & Budget',
    description: 'Fiscal workspace — requisitions, POs, invoice approval, encumbrances, and Cherry Sheet (MGL c.44)',
  },
  {
    id: 'records',
    label: 'Records Requests',
    description: 'Public records intake, 10-day clock, review, redact, and produce under MGL c.66 — retention 2 yr',
  },
  {
    id: 'procurement',
    label: 'Procurement',
    description: 'MGL Chapter 30B procurement compliance tracker for bids, contracts, and thresholds',
  },
  {
    id: 'evidence',
    label: 'Document Intelligence',
    description: 'Scan → text → classify → link to open case → sealed on ingest. Inherits retention schedule from the parent case.',
    adminOnly: true,
  },
  {
    id: 'govai',
    label: 'AI Drafting Assist',
    description: 'Draft minutes, notices, and letters — every output logged with prompt, model version, and approving user. Human approves all.',
    adminOnly: true,
  },
  {
    id: 'clerk',
    label: 'Meeting Records',
    description: 'Board meeting agendas, minutes, votes, legal notices, and OML compliance certificates',
  },
  {
    id: 'fix',
    label: 'Service Requests',
    description: 'Issue reporting, department dispatch, inspection, closure, and resident notification',
  },
  {
    id: 'onboard',
    label: 'Role Continuity',
    description: 'Onboarding playbooks, access provisioning, task transfer, handoff packages, and 30/60/90 check-ins',
  },
  {
    id: 'comms',
    label: 'Notices & Communications',
    description: 'Legal publication proofs, public notices, resident alerts, and emergency notifications',
  },
  {
    id: 'time',
    label: 'Deadline Tracking',
    description: 'Statute clocks, cross-module deadline sync, escalation on breach, and extension requests',
  },
  {
    id: 'boardcompliance',
    label: 'Board Compliance',
    description: 'Appointments, term expirations, ethics disclosures, conflict of interest log, and vacancy management',
  },
  {
    id: 'capital',
    label: 'Capital',
    description: 'Unified capital projects and grants management — project scoping, budget tracking, grant compliance (2 CFR 200, state & federal), milestones, procurement tie-in, and closeout packages',
  },
  {
    id: 'permitting',
    label: 'Permitting',
    description: 'Permit applications, multi-department review routing, inspection scheduling, violation tracking, and certificate issuance',
  },
  {
    id: 'staffhr',
    label: 'Staff & HR',
    description: 'Position register, hire-to-departure continuity, evaluation, separation, and training and certification tracking',
  },
  {
    id: 'townfinder',
    label: 'Town Finder',
    description: 'Browse all 310 Massachusetts towns under 25,000 population — pull fiscal data, import staff and budget CSVs, generate pre-filled documents, and connect M365, Google, and CivicPlus.',
  },
  {
    id: 'puddles',
    label: 'Puddles',
    description: 'Tenant-scoped operator chat with live PuddleJumper tools for PRRs, governance, org status, procurement, and system health.',
  },
  {
    id: 'stay',
    label: 'Stay',
    description: 'Short-term rental and lodging management — host registration, unit compliance, inspection scheduling, lodging excise tax tracking, complaint intake, and renewal workflows',
  },
  {
    id: 'routingengine',
    label: 'Routing Engine',
    description: 'Approval routing rules — define chains, thresholds, and notification triggers with a visual rule builder and live simulator',
    adminOnly: true,
  },
]

/** Look up a tool definition by ID. Falls back to a minimal stub. */
export function getTool(id: string): ToolDefinition {
  return (
    TOOLS_REGISTRY.find(t => t.id === id) ?? {
      id: id as ToolId,
      label: id,
      description: '',
    }
  )
}

/** All non-admin-only tools — shown in the member tool assignment list.
 * @deprecated Unused — retained for future permission UI. Remove when needed.
 */
export const ASSIGNABLE_TOOLS = TOOLS_REGISTRY.filter(t => !t.adminOnly)
