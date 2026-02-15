"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { pjFetch } from "../../lib/pjFetch";
import { useCallback, useEffect, useState } from "react";

type PrrRow = {
  id: string;
  public_id?: string;
  status: string;
  tenantId: string;
  received_at: string;
  statutory_due_at?: string;
};

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<PrrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await pjFetch("/api/prr?limit=50");
      if (!res.ok) throw new Error(`Failed to load PRRs (${res.status})`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchRecords();
  }, [user, fetchRecords]);

  if (authLoading) return <Loading />;
  if (!user) return <Redirect />;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition text-sm">&larr; Home</Link>
            <h1 className="text-2xl font-semibold">PRR Dashboard</h1>
          </div>
          <button
            type="button"
            onClick={fetchRecords}
            disabled={loading}
            className="rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {!loading && records.length === 0 && (
          <p className="text-zinc-500">No public records requests found.</p>
        )}

        {records.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase text-zinc-400">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/40 transition">
                    <td className="px-4 py-3 font-mono text-xs text-emerald-300">
                      {r.public_id ?? r.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{r.tenantId}</td>
                    <td className="px-4 py-3 text-zinc-400">{new Date(r.received_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {r.statutory_due_at ? new Date(r.statutory_due_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-blue-500/20 text-blue-300",
    in_progress: "bg-amber-500/20 text-amber-300",
    closed: "bg-zinc-700/40 text-zinc-400",
    overdue: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-zinc-700/40 text-zinc-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
      Loading…
    </div>
  );
}

function Redirect() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400">
      <p>Please sign in to view the dashboard.</p>
      <Link href="/" className="text-emerald-400 hover:underline">Go to Home</Link>
    </div>
  );
}
