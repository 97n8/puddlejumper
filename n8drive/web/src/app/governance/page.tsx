"use client";

import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { RequireAuth } from "../../lib/RequireAuth";
import { pjFetch } from "../../lib/pjFetch";
import { useState } from "react";

export default function GovernancePage() {
  return (
    <RequireAuth>
      <GovernanceContent />
    </RequireAuth>
  );
}

function GovernanceContent() {
  const { manifest } = useAuth();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);

  const [actions, setActions] = useState<{ id: string; label: string }[] | null>(null);
  const [actionsLoading, setActionsLoading] = useState(false);

  const [evalInput, setEvalInput] = useState("");
  const [evalResult, setEvalResult] = useState<Record<string, unknown> | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const canExecute = manifest?.capabilities["evaluate.execute"] === true;
  const canEditPrompt = manifest?.capabilities["corePrompt.edit"] === true;

  const fetchPrompt = async () => {
    setPromptLoading(true);
    setPromptError(null);
    try {
      const endpoint = canEditPrompt ? "/api/prompt" : "/api/core-prompt";
      const res = await pjFetch(endpoint);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setPrompt(typeof data === "string" ? data : data.prompt ?? JSON.stringify(data, null, 2));
    } catch (err) {
      setPromptError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPromptLoading(false);
    }
  };

  const fetchActions = async () => {
    setActionsLoading(true);
    try {
      const res = await pjFetch("/api/pj/actions");
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      setActions(Array.isArray(data) ? data : []);
    } catch {
      setActions([]);
    } finally {
      setActionsLoading(false);
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalInput.trim()) return;
    setEvalLoading(true);
    setEvalError(null);
    setEvalResult(null);
    try {
      const res = await pjFetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ request: evalInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Evaluation failed (${res.status})`);
      setEvalResult(data);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition text-sm">&larr; Home</Link>
          <h1 className="text-2xl font-semibold">Governance Engine</h1>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        {/* Capabilities summary */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="mb-3 text-lg font-semibold">Your Permissions</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {manifest &&
              Object.entries(manifest.capabilities).map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className={value ? "text-emerald-400" : "text-zinc-600"}>
                    {value ? "✓" : "✗"}
                  </span>
                  <span className={value ? "text-zinc-200" : "text-zinc-500"}>{key}</span>
                </li>
              ))}
          </ul>
        </section>

        {/* Actions */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Available Actions</h2>
            <button
              type="button"
              onClick={fetchActions}
              disabled={actionsLoading}
              className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
            >
              {actionsLoading ? "Loading…" : "Load Actions"}
            </button>
          </div>
          {actions && actions.length === 0 && (
            <p className="text-sm text-zinc-500">No actions available for your permission level.</p>
          )}
          {actions && actions.length > 0 && (
            <ul className="space-y-2">
              {actions.map((a) => (
                <li key={a.id} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm">
                  <span className="font-mono text-emerald-300">{a.id}</span>
                  <span className="ml-3 text-zinc-400">{a.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Core Prompt */}
        {canExecute && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">
                {canEditPrompt ? "System Prompt (Admin)" : "Core Prompt (Summary)"}
              </h2>
              <button
                type="button"
                onClick={fetchPrompt}
                disabled={promptLoading}
                className="rounded-full bg-emerald-500 px-4 py-1 text-xs font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {promptLoading ? "Loading…" : "View Prompt"}
              </button>
            </div>
            {promptError && <p className="text-sm text-red-400">{promptError}</p>}
            {prompt && (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-xs text-zinc-300 whitespace-pre-wrap">
                {prompt}
              </pre>
            )}
          </section>
        )}

        {/* Evaluate Request */}
        {canExecute && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="mb-3 text-lg font-semibold">Submit for Evaluation</h2>
            <form onSubmit={handleEvaluate} className="space-y-3">
              <textarea
                value={evalInput}
                onChange={(e) => setEvalInput(e.target.value)}
                placeholder="Describe the governance request to evaluate…"
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={evalLoading || !evalInput.trim()}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {evalLoading ? "Evaluating…" : "Evaluate"}
              </button>
            </form>
            {evalError && <p className="mt-3 text-sm text-red-400">{evalError}</p>}
            {evalResult && (
              <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4">
                <h3 className="mb-2 text-sm font-medium text-emerald-300">Evaluation Result</h3>
                <pre className="max-h-48 overflow-auto text-xs text-zinc-300 whitespace-pre-wrap">
                  {JSON.stringify(evalResult, null, 2)}
                </pre>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
