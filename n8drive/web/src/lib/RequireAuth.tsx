"use client";

import Link from "next/link";
import { useAuth } from "./auth";
import type { ReactNode } from "react";

/**
 * Reusable auth gate. Renders children only when authenticated.
 * Shows loading spinner during session restore; sign-in prompt when unauthenticated.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-400">
        <p>Please sign in to access this page.</p>
        <Link href="/" className="text-emerald-400 hover:underline">
          Go to Home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
