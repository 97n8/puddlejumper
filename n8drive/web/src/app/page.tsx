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

  // Login form state (manual token fallback)
  const [showManualLogin, setShowManualLogin] = useState(false);
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

            {/* OAuth buttons */}
            <div className="flex flex-col gap-3 max-w-md">
              <button
                type="button"
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://publiclogic-puddlejumper.fly.dev";
                  window.location.href = `${apiUrl}/api/auth/github/login`;
                }}
                className="flex items-center justify-center gap-3 rounded-lg bg-zinc-100 px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Sign in with GitHub
              </button>

              <button
                type="button"
                disabled
                className="flex items-center justify-center gap-3 rounded-lg bg-zinc-800 px-5 py-3 text-sm font-medium text-zinc-500 cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google (Coming Soon)
              </button>
            </div>

            {/* Manual token fallback */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowManualLogin(!showManualLogin)}
                className="text-xs text-zinc-500 underline hover:text-zinc-300"
              >
                {showManualLogin ? "Hide manual login" : "Use a token instead"}
              </button>
              {showManualLogin && (
                <form onSubmit={handleLogin} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
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
              )}
            </div>
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
