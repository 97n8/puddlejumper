"use client";

/**
 * Global error boundary – catches unhandled errors during rendering.
 * Replaces the generic "Application error: a client-side exception has occurred" page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
        <div className="max-w-xl space-y-4">
          <h1 className="text-2xl font-semibold text-red-400">Something went wrong</h1>
          <p className="text-zinc-400 text-sm">
            {error.message || "An unexpected error occurred."}
          </p>
          {error.digest && (
            <p className="text-zinc-600 text-xs font-mono">Digest: {error.digest}</p>
          )}
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-xs text-zinc-400 whitespace-pre-wrap">
            {error.stack || String(error)}
          </pre>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-emerald-950 transition hover:bg-emerald-400"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
