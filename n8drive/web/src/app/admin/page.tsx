"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../../lib/RequireAuth";
import { pjFetch } from "../../lib/pjFetch";
import { useCallback, useEffect, useState } from "react";

type Tab = "stats" | "members" | "templates";

type WorkspaceStats = {
  approvals?: { total?: number; pending?: number; approved?: number; rejected?: number };
  dispatches?: { total?: number; success?: number; failed?: number };
  prrs?: { total?: number; open?: number; closed?: number };
  [key: string]: unknown;
};

type WorkspaceUsage = {
  templates?: { used: number; limit: number };
  approvals?: { used: number; limit: number };
  members?: { used: number; limit: number };
  plan?: string;
  [key: string]: unknown;
};

type Member = {
  userId: string;
  email?: string;
  name?: string;
  role: string;
  joinedAt?: string;
};

type ChainTemplate = {
  id: string;
  name: string;
  steps: number;
  createdAt?: string;
};

export default function AdminPage() {
  return (
    <RequireAuth>
      <AdminContent />
    </RequireAuth>
  );
}

function AdminContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<ChainTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usageRes] = await Promise.all([
        pjFetch("/api/admin/stats"),
        pjFetch("/api/workspace/usage"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usageRes.ok) setUsage(await usageRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pjFetch("/api/workspace/members");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
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

  const handleRoleChange = useCallback(async (userId: string, role: string) => {
    try {
      const res = await pjFetch(`/api/workspace/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [fetchMembers]);

  const handleRemoveMember = useCallback(async (userId: string) => {
    try {
      const res = await pjFetch(`/api/workspace/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }
      fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [fetchMembers]);

  useEffect(() => {
    if (!user) return;
    if (tab === "stats") fetchStats();
    else if (tab === "members") fetchMembers();
    else if (tab === "templates") fetchTemplates();
  }, [user, tab, fetchStats, fetchMembers, fetchTemplates]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "stats", label: "Stats", icon: "📊" },
    { key: "members", label: "Members", icon: "👥" },
    { key: "templates", label: "Templates", icon: "📋" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition text-sm">&larr; Home</Link>
            <h1 className="text-2xl font-semibold">Admin</h1>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6">
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {tab === "stats" && <StatsTab stats={stats} usage={usage} loading={loading} />}
        {tab === "members" && (
          <MembersTab
            members={members}
            loading={loading}
            onRoleChange={handleRoleChange}
            onRemove={handleRemoveMember}
          />
        )}
        {tab === "templates" && <TemplatesTab templates={templates} loading={loading} />}
      </main>
    </div>
  );
}

/* ── Stats Tab ──────────────────────────────────────────────── */

function StatsTab({ stats, usage, loading }: { stats: WorkspaceStats | null; usage: WorkspaceUsage | null; loading: boolean }) {
  if (loading) return <p className="text-zinc-500">Loading stats…</p>;
  if (!stats && !usage) return <p className="text-zinc-500">No stats available.</p>;

  return (
    <div className="space-y-6">
      {/* Usage / Tier */}
      {usage && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workspace Usage</h2>
            {usage.plan && (
              <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
                {usage.plan} plan
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {usage.templates && <UsageBar label="Templates" used={usage.templates.used} limit={usage.templates.limit} />}
            {usage.approvals && <UsageBar label="Approvals" used={usage.approvals.used} limit={usage.approvals.limit} />}
            {usage.members && <UsageBar label="Members" used={usage.members.used} limit={usage.members.limit} />}
          </div>
        </section>
      )}

      {/* Operational stats */}
      {stats && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold">Operational Metrics</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.approvals && (
              <>
                <StatCard label="Total Approvals" value={stats.approvals.total ?? 0} />
                <StatCard label="Pending" value={stats.approvals.pending ?? 0} color="amber" />
                <StatCard label="Approved" value={stats.approvals.approved ?? 0} color="emerald" />
                <StatCard label="Rejected" value={stats.approvals.rejected ?? 0} color="red" />
              </>
            )}
            {stats.dispatches && (
              <>
                <StatCard label="Total Dispatches" value={stats.dispatches.total ?? 0} />
                <StatCard label="Successful" value={stats.dispatches.success ?? 0} color="emerald" />
                <StatCard label="Failed" value={stats.dispatches.failed ?? 0} color="red" />
              </>
            )}
            {stats.prrs && (
              <>
                <StatCard label="Total PRRs" value={stats.prrs.total ?? 0} />
                <StatCard label="Open PRRs" value={stats.prrs.open ?? 0} color="blue" />
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-300">{used} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  const textColor = color ? `text-${color}-300` : "text-zinc-100";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${textColor}`}>{value}</p>
    </div>
  );
}

/* ── Members Tab ────────────────────────────────────────────── */

function MembersTab({
  members,
  loading,
  onRoleChange,
  onRemove,
}: {
  members: Member[];
  loading: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string) => void;
}) {
  if (loading) return <p className="text-zinc-500">Loading members…</p>;
  if (members.length === 0) return <p className="text-zinc-500">No members found.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-400">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {members.map((m) => (
            <tr key={m.userId} className="hover:bg-zinc-900/40 transition">
              <td className="px-4 py-3">
                <div>
                  <span className="text-zinc-200">{m.name ?? m.email ?? m.userId}</span>
                  {m.email && m.name && <span className="ml-2 text-xs text-zinc-500">{m.email}</span>}
                </div>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={m.role} />
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">
                {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {m.role !== "owner" && (
                    <>
                      <select
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
                        defaultValue={m.role}
                        onChange={(e) => onRoleChange(m.userId, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => onRemove(m.userId)}
                        className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/40 transition"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {m.role === "owner" && <span className="text-xs text-zinc-600">—</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: "bg-purple-500/20 text-purple-300",
    admin: "bg-blue-500/20 text-blue-300",
    member: "bg-emerald-500/20 text-emerald-300",
    viewer: "bg-zinc-700/40 text-zinc-400",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] ?? "bg-zinc-700/40 text-zinc-400"}`}>
      {role}
    </span>
  );
}

/* ── Templates Tab ──────────────────────────────────────────── */

function TemplatesTab({ templates, loading }: { templates: ChainTemplate[]; loading: boolean }) {
  if (loading) return <p className="text-zinc-500">Loading templates…</p>;
  if (templates.length === 0) return <p className="text-zinc-500">No chain templates found.</p>;

  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <div key={t.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-emerald-300">{t.id.slice(0, 8)}</span>
              <h3 className="text-sm font-medium text-zinc-200">{t.name}</h3>
            </div>
            <div className="text-right text-xs text-zinc-500">
              <span>{t.steps} step{t.steps !== 1 ? "s" : ""}</span>
              {t.createdAt && <span className="ml-2">{new Date(t.createdAt).toLocaleDateString()}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
