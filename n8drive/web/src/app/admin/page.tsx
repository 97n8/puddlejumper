"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../../lib/RequireAuth";
import { pjFetch } from "../../lib/pjFetch";
import { useCallback, useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "queue" | "chains" | "dashboard" | "members" | "prr";

type Approval = {
  id: string;
  action_intent: string;
  approval_status: string;
  operator_id: string;
  created_at: string;
  chain_progress?: { current: number; total: number };
};

type ChainTemplate = {
  id: string;
  name: string;
  description?: string;
  steps: Array<{ role: string; parallel?: boolean }>;
  createdAt?: string;
};

type WorkspaceStats = {
  pending: number;
  approvalsCreated: number;
  approvalsApproved: number;
  approvalsRejected: number;
  approvalsExpired: number;
  dispatchSuccess: number;
  dispatchFailure: number;
  dispatchRetry: number;
  casConflict: number;
  avgApprovalTimeSec: number;
  avgDispatchLatencySec: number;
  activeChainSteps: number;
};

type WorkspaceUsage = {
  templates: { used: number; limit: number };
  approvals: { used: number; limit: number };
  members: { used: number; limit: number };
  plan: string;
};

type Member = {
  userId: string;
  email?: string;
  name?: string;
  role: string;
  joinedAt?: string;
  invitedBy?: string;
};

type PRR = {
  id: string;
  submitter_name: string;
  submitter_email?: string;
  summary: string;
  details?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("queue");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Toggle auto-refresh (30s polling)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "queue", label: "Approval Queue", icon: "✅" },
    { key: "chains", label: "Chain Templates", icon: "📋" },
    { key: "dashboard", label: "Dashboard", icon: "📊" },
    { key: "members", label: "Members", icon: "👥" },
    { key: "prr", label: "PRR", icon: "📄" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition text-sm">
              &larr; Home
            </Link>
            <h1 className="text-2xl font-semibold">PuddleJumper Admin</h1>
            <span className="text-xs text-zinc-500">Control Plane</span>
          </div>
          <div className="flex items-center gap-3">
            {autoRefresh && (
              <span className="text-xs text-zinc-500">⟳ Auto-refresh</span>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="text-xs px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition"
            >
              {autoRefresh ? "Disable" : "Enable"} Auto-refresh
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex gap-1 border-t border-zinc-800 pt-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                  tab === t.key
                    ? "bg-zinc-900/80 text-emerald-300 border-b-2 border-emerald-500"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === "queue" && <ApprovalQueueTab refreshTrigger={refreshTrigger} />}
        {tab === "chains" && <ChainTemplatesTab />}
        {tab === "dashboard" && <DashboardTab refreshTrigger={refreshTrigger} />}
        {tab === "members" && <MembersTab />}
        {tab === "prr" && <PRRTab />}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval Queue Tab
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalQueueTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      const res = await pjFetch(`/api/approvals?${params}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setApprovals(Array.isArray(data) ? data : data.data?.approvals ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals, refreshTrigger]);

  const handleDecide = async (id: string, decision: "approve" | "reject") => {
    try {
      const res = await pjFetch(`/api/approvals/${id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      loadApprovals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Approval Queue</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="dispatched">Dispatched</option>
          <option value="dispatch_failed">Dispatch Failed</option>
          <option value="expired">Expired</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-zinc-500">Loading approvals...</p>}

      {!loading && approvals.length === 0 && (
        <p className="text-zinc-500 text-center py-8">
          No approvals match the selected filter.
        </p>
      )}

      {!loading && approvals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-3">Intent</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Chain Progress</th>
                <th className="text-left py-2 px-3">Operator</th>
                <th className="text-left py-2 px-3">Created</th>
                <th className="text-left py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                  <td className="py-2 px-3">{approval.action_intent}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        approval.approval_status === "approved"
                          ? "bg-green-500/20 text-green-300"
                          : approval.approval_status === "rejected"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {approval.approval_status}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    {approval.chain_progress
                      ? `${approval.chain_progress.current}/${approval.chain_progress.total}`
                      : "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{approval.operator_id.substring(0, 8)}</td>
                  <td className="py-2 px-3 text-zinc-400">{timeAgo(approval.created_at)}</td>
                  <td className="py-2 px-3">
                    {approval.approval_status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDecide(approval.id, "approve")}
                          className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecide(approval.id, "reject")}
                          className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain Templates Tab
// ─────────────────────────────────────────────────────────────────────────────

function ChainTemplatesTab() {
  const [templates, setTemplates] = useState<ChainTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formSteps, setFormSteps] = useState<Array<{ role: string }>>([{ role: "" }]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pjFetch("/api/chain-templates");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormDesc("");
    setFormSteps([{ role: "" }]);
    setShowForm(true);
  };

  const handleEdit = (template: ChainTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormDesc(template.description || "");
    setFormSteps(template.steps.map((s) => ({ role: s.role })));
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      setError("Template name is required");
      return;
    }
    if (formSteps.some((s) => !s.role.trim())) {
      setError("All steps must have a role");
      return;
    }

    try {
      const body = { name: formName, description: formDesc, steps: formSteps };
      const url = editingId ? `/api/chain-templates/${editingId}` : "/api/chain-templates";
      const method = editingId ? "PUT" : "POST";
      const res = await pjFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setShowForm(false);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try {
      const res = await pjFetch(`/api/chain-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chain Templates</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Define multi-step approval routing with sequential steps
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded transition text-sm font-medium"
        >
          + Create Template
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {showForm && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold">{editingId ? "Edit Template" : "Create Template"}</h3>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Two-Step Legal Review"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Brief description"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Steps</label>
            {formSteps.map((step, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={step.role}
                  onChange={(e) => {
                    const updated = [...formSteps];
                    updated[idx].role = e.target.value;
                    setFormSteps(updated);
                  }}
                  placeholder="e.g. dept_head"
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm"
                />
                {formSteps.length > 1 && (
                  <button
                    onClick={() => setFormSteps(formSteps.filter((_, i) => i !== idx))}
                    className="px-3 py-2 bg-red-500/20 text-red-300 rounded text-sm hover:bg-red-500/30 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setFormSteps([...formSteps, { role: "" }])}
              className="text-xs px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition"
            >
              + Add Step
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition"
            >
              Save Template
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-zinc-500">Loading templates...</p>}

      {!loading && templates.length === 0 && !showForm && (
        <p className="text-zinc-500 text-center py-8">
          No chain templates yet — create one above to define multi-step approval routing.
        </p>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.description && (
                    <p className="text-xs text-zinc-500 mt-1">{template.description}</p>
                  )}
                </div>
              </div>
              <div className="text-xs text-zinc-400">
                <span className="font-semibold">{template.steps.length}</span> step
                {template.steps.length !== 1 ? "s" : ""}:
              </div>
              <ol className="text-xs text-zinc-500 space-y-1 pl-4">
                {template.steps.map((step, idx) => (
                  <li key={idx} className="list-decimal">
                    {step.role}
                  </li>
                ))}
              </ol>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleEdit(template)}
                  className="text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="text-xs px-2 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 rounded transition"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Tab (continued in next file - this is getting long)
// ─────────────────────────────────────────────────────────────────────────────

function DashboardTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pjFetch("/api/admin/stats");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setStats(data.data ?? data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshTrigger]);

  if (loading) return <p className="text-zinc-500">Loading dashboard...</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!stats) return <p className="text-zinc-500">No stats available.</p>;

  const successRate =
    stats.approvalsCreated > 0
      ? ((stats.approvalsApproved / stats.approvalsCreated) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Operational Dashboard</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending Approvals" value={stats.pending} color="yellow" />
        <StatCard label="Success Rate" value={`${successRate}%`} color="green" />
        <StatCard label="Dispatch Retries" value={stats.dispatchRetry} color="gray" />
        <StatCard
          label="Avg Approval Time"
          value={`${stats.avgApprovalTimeSec.toFixed(1)}s`}
          color="gray"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Approvals Created" value={stats.approvalsCreated} color="gray" />
        <StatCard label="Approved" value={stats.approvalsApproved} color="green" />
        <StatCard label="Rejected" value={stats.approvalsRejected} color="red" />
        <StatCard label="Expired" value={stats.approvalsExpired} color="gray" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Dispatch Success" value={stats.dispatchSuccess} color="green" />
        <StatCard label="Dispatch Failure" value={stats.dispatchFailure} color="red" />
        <StatCard
          label="Avg Dispatch Latency"
          value={`${stats.avgDispatchLatencySec.toFixed(1)}s`}
          color="gray"
        />
        <StatCard label="Active Chain Steps" value={stats.activeChainSteps} color="yellow" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: number | string;
  color?: "gray" | "green" | "red" | "yellow";
}) {
  const colorClasses = {
    gray: "text-zinc-300",
    green: "text-emerald-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Members Tab
// ─────────────────────────────────────────────────────────────────────────────

function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, usageRes] = await Promise.all([
        pjFetch("/api/workspace/members"),
        pjFetch("/api/workspace/usage"),
      ]);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(Array.isArray(data) ? data : data.data ?? []);
      }
      if (usageRes.ok) {
        const data = await usageRes.json();
        setUsage(data.data ?? data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <div className="space-y-6">
      {usage && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Workspace Usage</h3>
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                  usage.plan === "free"
                    ? "bg-zinc-700 text-zinc-300"
                    : "bg-blue-500/20 text-blue-300"
                }`}
              >
                {usage.plan.toUpperCase()} PLAN
              </span>
            </div>
            {usage.plan === "free" && (
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition">
                ⬆️ Upgrade
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <UsageBar label="Templates" used={usage.templates.used} limit={usage.templates.limit} />
            <UsageBar label="Approvals" used={usage.approvals.used} limit={usage.approvals.limit} />
            <UsageBar label="Members" used={usage.members.used} limit={usage.members.limit} />
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">Workspace Members</h2>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        {loading && <p className="text-zinc-500">Loading members...</p>}

        {!loading && members.length === 0 && (
          <p className="text-zinc-500 text-center py-8">No workspace members found.</p>
        )}

        {!loading && members.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800">
                <tr>
                  <th className="text-left py-2 px-3">User ID</th>
                  <th className="text-left py-2 px-3">Email</th>
                  <th className="text-left py-2 px-3">Role</th>
                  <th className="text-left py-2 px-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.userId} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="py-2 px-3 font-mono text-xs">{member.userId.substring(0, 12)}</td>
                    <td className="py-2 px-3">{member.email || "—"}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded text-xs bg-zinc-800">{member.role}</span>
                    </td>
                    <td className="py-2 px-3 text-zinc-400">
                      {member.joinedAt ? timeAgo(member.joinedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? (used / limit) * 100 : 0;
  const isNearLimit = percent >= 80;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
        <span>{label}</span>
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isNearLimit ? "bg-yellow-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRR Tab
// ─────────────────────────────────────────────────────────────────────────────

function PRRTab() {
  const [prrs, setPrrs] = useState<PRR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDue, setFormDue] = useState("");

  const loadPRRs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      const res = await pjFetch(`/api/prr?${params}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setPrrs(Array.isArray(data) ? data : data.data?.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadPRRs();
  }, [loadPRRs]);

  const handleSubmit = async () => {
    if (!formName.trim() || !formDesc.trim()) {
      setError("Requester name and description are required");
      return;
    }

    try {
      const body: any = { requesterName: formName, description: formDesc };
      if (formDue) body.dueDate = formDue;
      const res = await pjFetch("/api/prr", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setShowForm(false);
      setFormName("");
      setFormDesc("");
      setFormDue("");
      loadPRRs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Public Records Requests</h2>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-sm"
          >
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition"
          >
            + New Request
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-5 space-y-4">
          <h3 className="font-semibold">New Public Records Request</h3>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Requester Name</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Jane Sullivan"
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Describe the records being requested..."
              rows={4}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Due Date (optional)</label>
            <input
              type="date"
              value={formDue}
              onChange={(e) => setFormDue(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-sm transition"
            >
              Create Request
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {loading && <p className="text-zinc-500">Loading PRRs...</p>}

      {!loading && prrs.length === 0 && (
        <p className="text-zinc-500 text-center py-8">No public records requests found.</p>
      )}

      {!loading && prrs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className="text-left py-2 px-3">ID</th>
                <th className="text-left py-2 px-3">Submitter</th>
                <th className="text-left py-2 px-3">Summary</th>
                <th className="text-left py-2 px-3">Status</th>
                <th className="text-left py-2 px-3">Assigned</th>
                <th className="text-left py-2 px-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {prrs.map((prr) => (
                <tr key={prr.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                  <td className="py-2 px-3 font-mono text-xs">{prr.id.substring(0, 8)}</td>
                  <td className="py-2 px-3">
                    <div>{prr.submitter_name}</div>
                    {prr.submitter_email && (
                      <div className="text-xs text-zinc-500">{prr.submitter_email}</div>
                    )}
                  </td>
                  <td className="py-2 px-3">{prr.summary}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        prr.status === "closed"
                          ? "bg-zinc-700 text-zinc-300"
                          : prr.status === "in_progress"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-yellow-500/20 text-yellow-300"
                      }`}
                    >
                      {prr.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2 px-3">{prr.assigned_to || "—"}</td>
                  <td className="py-2 px-3 text-zinc-400">{timeAgo(prr.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
