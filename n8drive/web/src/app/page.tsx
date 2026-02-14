"use client";

import { useState } from "react";

type HealthPayload = Record<string, unknown>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

const placeholderTiles = [
  {
    id: "mission-control",
    name: "Mission Control",
    icon: "🛰️",
    description: "Tile coming soon...",
  },
  {
    id: "status-reports",
    name: "Status Reports",
    icon: "📊",
    description: "Tile coming soon...",
  },
  {
    id: "connector-hub",
    name: "Connector Hub",
    icon: "🔌",
    description: "Tile coming soon...",
  },
  {
    id: "insights",
    name: "Insights",
    icon: "💡",
    description: "Tile coming soon...",
  },
];

export default function Home() {
  const [isChecking, setIsChecking] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleHealthCheck = async () => {
    setIsChecking(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/health`, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const payload = (await response.json()) as HealthPayload;
      setHealth(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setHealth(null);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <h1 className="text-3xl font-semibold">PuddleJumper</h1>
          <span className="text-sm text-zinc-400">API Target: {API_URL}</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Health Monitor</h2>
              <p className="text-sm text-zinc-400">
                Trigger a health check to verify the Fly.io backend is
                responding.
              </p>
            </div>
            <button
              type="button"
              onClick={handleHealthCheck}
              disabled={isChecking}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isChecking ? "Checking…" : "Check Health"}
            </button>
          </div>

          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
            {error && (
              <p className="text-red-400">Health check failed: {error}</p>
            )}

            {!error && health && (
              <pre className="whitespace-pre-wrap break-all text-emerald-200">
                {JSON.stringify(health, null, 2)}
              </pre>
            )}

            {!error && !health && (
              <p className="text-zinc-400">
                Health status will appear here after you click the button.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-lg">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Tiles</h2>
            <span className="text-xs uppercase tracking-wide text-zinc-500">
              Placeholder
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {placeholderTiles.map((tile) => (
              <article
                key={tile.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center transition hover:border-emerald-500/60 hover:shadow-lg"
              >
                <div className="mb-3 text-4xl">{tile.icon}</div>
                <h3 className="text-lg font-medium text-zinc-100">
                  {tile.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-400">{tile.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
