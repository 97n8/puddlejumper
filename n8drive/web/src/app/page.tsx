"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { pjFetch } from "../lib/pjFetch";

type HealthPayload = Record<string, unknown>;

// ── Capability-to-tile mapping ─────────────────────────────────
// The system contract says: "UI driven entirely by manifest; hidden if flag is false."
// Each tile is shown only when its capability key is true in the manifest.
const TILE_DEFS: {
  capability: string;
  id: string;
  name: string;
  icon: string;
  description: string;
  href: string;
}[] = [
  {
    capability: "missionControl.capabilities.read",
    id: "mission-control",
    name: "Mission Control",
    icon: "\u{1F6F0}\uFE0F",
    description: "View live system capabilities and operational status.",
    href: "/governance",
  },
  {
    capability: "popout.launch",
    id: "popout",
    name: "Pop-out Launcher",
    icon: "\u{1F680}",
    description: "Launch governed pop-out windows.",
    href: "/governance",
  },
  {
    capability: "missionControl.tiles.read",
    id: "tiles",
    name: "Tile Manager",
    icon: "\u{1F4CB}",
    description: "Browse and manage live tiles.",
    href: "/dashboard",
  },
  {
    capability: "evaluate.execute",
    id: "evaluate",
    name: "Governance Engine",
    icon: "\u2696\uFE0F",
    description: "Submit and evaluate governance decisions.",
    href: "/governance",
  },
];

export default function Home() {
  const { user, manifest, runtimeCtx, loading, error: authError, login, logout } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Login form state
  const [provider, setProvider] = useState<"google" | "github">("github");
  const [providerToken, setProviderToken] = useState("");

  const handleHealthCheck = async () => {
    setIsChecking(true);
    setHealthError(null);
    try {
      const response = await pjFetch("/health");
      if (!response.ok) throw new Error(`Health check failed (${response.status})`);
      setHealth((await response.json()) as HealthPayload);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : "Unknown error");
      setHealth(null);
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerToken.trim()) return;
    try {
      await login(provider, providerToken.trim());
      setProviderToken("");
    } catch {
      // error is surfaced via useAuth().error
    }
  };

  // Filter tiles to only those the manifest grants
  const visibleTiles = manifest
    ? TILE_DEFS.filter((t) => manifest.capabilities[t.capability] === true)
    : [];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <h1 className="text-3xl font-semibold">PuddleJumper</h1>
          <div className="flex items-center gap-4">
            {runtimeCtx && (
              <span className="text-xs text-zinc-500">
                {runtimeCtx.workspace.id} / {runtimeCtx.operator ?? "—"}
              </span>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span data-testid="user-menu" className="text-sm text-zinc-300">
                  {user.name ?? user.email ?? user.sub}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <span className="text-sm text-zinc-500">Not signed in</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        {/* ── Login ────────────────────────────────────────── */}
        {!user && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg">
            <h2 className="mb-4 text-xl font-semibold">Sign in</h2>
            {authError && <p className="mb-3 text-sm text-red-400">{authError}</p>}
            <form onSubmit={handleLogin} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-sm text-zinc-400">
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "google" | "github")}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                >
                  <option value="github">GitHub</option>
                  <option value="google">Google</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-400">
                Provider Token
                <input
                  type="password"
                  value={providerToken}
                  onChange={(e) => setProviderToken(e.target.value)}
                  placeholder="Paste OAuth token…"
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
              <button
                type="submit"
                disabled={loading || !providerToken.trim()}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        )}

        {/* ── Health Monitor ───────────────────────────────── */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Health Monitor</h2>
              <p className="text-sm text-zinc-400">
                Trigger a health check to verify the backend is responding.
              </p>
            </div>
            <button
              type="button"
              onClick={handleHealthCheck}
              disabled={isChecking}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChecking ? "Checking\u2026" : "Check Health"}
            </button>
          </div>
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
            {healthError && <p className="text-red-400">Health check failed: {healthError}</p>}
            {!healthError && health && (
              <pre className="whitespace-pre-wrap break-all text-emerald-200">
                {JSON.stringify(health, null, 2)}
              </pre>
            )}
            {!healthError && !health && (
              <p className="text-zinc-400">
                Health status will appear here after you click the button.
              </p>
            )}
          </div>
        </section>

        {/* ── Tiles (manifest-driven) ─────────────────────── */}
        {user && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Capabilities</h2>
              {manifest && (
                <span className="text-xs text-zinc-500">
                  {visibleTiles.length} available
                </span>
              )}
            </div>

            {!manifest && (
              <p className="text-sm text-zinc-500">Loading capabilities…</p>
            )}

            {manifest && visibleTiles.length === 0 && (
              <p className="text-sm text-zinc-500">
                No capabilities granted. Contact your administrator.
              </p>
            )}

            {visibleTiles.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleTiles.map((tile) => (
                  <Link
                    key={tile.id}
                    href={tile.href}
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center transition hover:border-emerald-500/60 hover:shadow-lg block"
                  >
                    <div className="mb-3 text-4xl">{tile.icon}</div>
                    <h3 className="text-lg font-medium text-zinc-100">{tile.name}</h3>
                    <p className="mt-2 text-sm text-zinc-400">{tile.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
