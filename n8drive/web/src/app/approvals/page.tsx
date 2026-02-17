"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../../lib/RequireAuth";
import { pjFetch } from "../../lib/pjFetch";
import { useCallback, useEffect, useState } from "react";

type ApprovalRow = {
  id: string;
  actionId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedBy: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
};

type ChainStep = {
  stepIndex: number;
  status: string;
  approver?: string;
  decidedAt?: string;
};

type ApprovalDetail = ApprovalRow & {
  payload?: Record<string, unknown>;
  chain?: ChainStep[];
};

export default function ApprovalsPage() {
  return (
    <RequireAuth>
      <ApprovalsContent />
    </RequireAuth>
  );
}

function ApprovalsContent() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprovalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pjFetch("/api/approvals");
      if (!res.ok) throw new Error(`Failed to load approvals (${res.status})`);
      const data = await res.json();
      setApprovals(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setActionResult(null);
    try {
      const [approvalRes, chainRes] = await Promise.all([
        pjFetch(`/api/approvals/${id}`),
        pjFetch(`/api/approvals/${id}/chain`),
      ]);
      if (!approvalRes.ok) throw new Error(`Failed to load approval (${approvalRes.status})`);
      const approval = await approvalRes.json();
      const chain = chainRes.ok ? await chainRes.json() : [];
      setSelected({ ...approval, chain: Array.isArray(chain) ? chain : chain.steps ?? [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleDecide = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      setActionLoading(true);
      setActionResult(null);
      try {
        const res = await pjFetch(`/api/approvals/${id}/decide`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Decision failed (${res.status})`);
        setActionResult({ ok: true, message: `Approval ${decision}` });
        fetchApprovals();
        fetchDetail(id);
      } catch (err) {
        setActionResult({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setActionLoading(false);
      }
    },
    [fetchApprovals, fetchDetail],
  );

  const handleDispatch = useCallback(
    async (id: string) => {
      setActionLoading(true);
      setActionResult(null);
      try {
        const res = await pjFetch(`/api/approvals/${id}/dispatch`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Dispatch failed (${res.status})`);
        setActionResult({ ok: true, message: "Dispatch executed successfully" });
        fetchApprovals();
        fetchDetail(id);
      } catch (err) {
        setActionResult({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setActionLoading(false);
      }
    },
    [fetchApprovals, fetchDetail],
  );

  useEffect(() => {
    if (user) fetchApprovals();
  }, [user, fetchApprovals]);

  // Poll for updates every 30 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchApprovals, 30_000);
    return () => clearInterval(interval);
  }, [user, fetchApprovals]);

  const filtered = filter === "all" ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition text-sm">&larr; Home</Link>
            <h1 className="text-2xl font-semibold">Approval Queue</h1>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                {pendingCount} pending
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={fetchApprovals}
            disabled={loading}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
              }`}
            >
              {f === "all" ? `All (${approvals.length})` : `${f} (${approvals.filter((a) => a.status === f).length})`}
            </button>
          ))}
        </div>

        <div className="flex gap-6">
          {/* Approval list */}
          <div className={`${selected ? "w-1/2" : "w-full"} transition-all`}>
            {!loading && filtered.length === 0 && (
              <p className="text-zinc-500">No approvals found.</p>
            )}

            {filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => fetchDetail(a.id)}
                    className={`w-full rounded-xl border p-4 text-left transition hover:border-emerald-500/60 ${
                      selected?.id === a.id
                        ? "border-emerald-500/60 bg-zinc-900/80"
                        : "border-zinc-800 bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-emerald-300">{a.id.slice(0, 8)}</span>
                      <ApprovalStatusBadge status={a.status} />
                    </div>
                    <p className="mt-1 text-sm text-zinc-300">{a.actionId}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      by {a.requestedBy} · {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-1/2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
              {detailLoading ? (
                <p className="text-zinc-500">Loading…</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Approval Detail</h2>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      Close
                    </button>
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-zinc-500">ID</dt>
                      <dd className="font-mono text-emerald-300">{selected.id}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Action</dt>
                      <dd className="text-zinc-200">{selected.actionId}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Status</dt>
                      <dd><ApprovalStatusBadge status={selected.status} /></dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Requested by</dt>
                      <dd className="text-zinc-200">{selected.requestedBy}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Created</dt>
                      <dd className="text-zinc-200">{new Date(selected.createdAt).toLocaleString()}</dd>
                    </div>
                    {selected.decidedAt && (
                      <div>
                        <dt className="text-zinc-500">Decided</dt>
                        <dd className="text-zinc-200">
                          {new Date(selected.decidedAt).toLocaleString()} by {selected.decidedBy ?? "—"}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {/* Chain progress */}
                  {selected.chain && selected.chain.length > 0 && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-medium text-zinc-400">Chain Progress</h3>
                      <div className="space-y-2">
                        {selected.chain.map((step) => (
                          <div
                            key={step.stepIndex}
                            className="flex items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-xs"
                          >
                            <span className={`h-2 w-2 rounded-full ${
                              step.status === "approved" ? "bg-emerald-400" :
                              step.status === "rejected" ? "bg-red-400" :
                              step.status === "pending" ? "bg-amber-400" :
                              "bg-zinc-600"
                            }`} />
                            <span className="text-zinc-300">Step {step.stepIndex + 1}</span>
                            <span className="text-zinc-500">{step.status}</span>
                            {step.approver && <span className="text-zinc-400 ml-auto">{step.approver}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {selected.status === "pending" && (
                    <div className="mt-5 flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleDecide(selected.id, "approved")}
                        disabled={actionLoading}
                        className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecide(selected.id, "rejected")}
                        disabled={actionLoading}
                        className="rounded-full border border-red-700 px-4 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950/40 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {selected.status === "approved" && (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => handleDispatch(selected.id)}
                        disabled={actionLoading}
                        className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-medium text-blue-950 transition hover:bg-blue-400 disabled:opacity-60"
                      >
                        Execute Dispatch
                      </button>
                    </div>
                  )}

                  {/* Action result */}
                  {actionResult && (
                    <div
                      className={`mt-4 rounded-lg border p-3 text-sm ${
                        actionResult.ok
                          ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                          : "border-red-800 bg-red-950/40 text-red-200"
                      }`}
                    >
                      {actionResult.message}
                    </div>
                  )}

                  {/* Payload preview */}
                  {selected.payload && Object.keys(selected.payload).length > 0 && (
                    <div className="mt-5">
                      <h3 className="mb-2 text-sm font-medium text-zinc-400">Payload</h3>
                      <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300 whitespace-pre-wrap">
                        {JSON.stringify(selected.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ApprovalStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-300",
    approved: "bg-emerald-500/20 text-emerald-300",
    rejected: "bg-red-500/20 text-red-300",
    expired: "bg-zinc-700/40 text-zinc-400",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-700/40 text-zinc-400"}`}>
      {status}
    </span>
  );
}
