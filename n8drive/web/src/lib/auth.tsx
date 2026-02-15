"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { pjFetch } from "./pjFetch";

// ── Types ──────────────────────────────────────────────────────

export type User = {
  sub: string;
  email?: string;
  name?: string;
  provider?: string;
} | null;

export type CapabilityManifest = {
  tenantId: string;
  userId: string;
  capabilities: Record<string, boolean>;
} | null;

export type RuntimeContext = {
  workspace: { id: string };
  municipality: { id: string };
  operator?: { id: string; name: string; role: string; permissions: string[]; delegations: string[] } | string;
} | null;

export type LiveTile = {
  id: string;
  label: string;
  icon: string;
  mode: "launch" | "governed";
  intent: string;
  target: string;
  tone: string;
  description: string;
  emergency?: boolean;
};

type AuthState = {
  user: User;
  manifest: CapabilityManifest;
  runtimeCtx: RuntimeContext;
  tiles: LiveTile[];
  loading: boolean;
  error: string | null;
  login: (provider: string, providerToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
};

const AuthCtx = createContext<AuthState>({
  user: null,
  manifest: null,
  runtimeCtx: null,
  tiles: [],
  loading: false,
  error: null,
  login: async () => {},
  logout: async () => {},
  refresh: async () => false,
});

// ── Helpers ────────────────────────────────────────────────────

/** Decode the payload section of a JWT for display (NOT for auth decisions). */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  try {
    return JSON.parse(atob(jwt.split(".")[1]));
  } catch {
    return {};
  }
}

/** How many ms until the JWT expires; returns 0 if already expired or unparseable. */
function msUntilExpiry(jwt: string): number {
  const payload = decodeJwtPayload(jwt);
  if (typeof payload.exp !== "number") return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

/** Refresh 60 seconds before expiry (or immediately if less than 60s left). */
const REFRESH_LEAD_MS = 60_000;

// ── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [manifest, setManifest] = useState<CapabilityManifest>(null);
  const [runtimeCtx, setRuntimeCtx] = useState<RuntimeContext>(null);
  const [tiles, setTiles] = useState<LiveTile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch manifest + runtime context + tiles once authenticated
  const fetchProtectedData = useCallback(async () => {
    try {
      const [mRes, cRes, tRes] = await Promise.all([
        pjFetch("/api/capabilities/manifest"),
        pjFetch("/api/runtime/context"),
        pjFetch("/api/config/tiles"),
      ]);
      if (mRes.ok) setManifest(await mRes.json());
      if (cRes.ok) setRuntimeCtx(await cRes.json());
      if (tRes.ok) {
        const tData = await tRes.json();
        setTiles(Array.isArray(tData) ? tData : []);
      }
    } catch {
      // non-fatal — tiles will just show as unavailable
    }
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  /** Schedule a silent refresh `delayMs` from now. */
  const scheduleRefresh = useCallback(
    (delayMs: number, doRefresh: () => Promise<boolean>) => {
      clearRefreshTimer();
      refreshTimerRef.current = setTimeout(async () => {
        const ok = await doRefresh();
        if (!ok) {
          // Refresh failed — session expired
          setUser(null);
          setManifest(null);
          setRuntimeCtx(null);
        }
      }, Math.max(0, delayMs));
    },
    [clearRefreshTimer],
  );

  // ── Refresh ────────────────────────────────────────────────
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await pjFetch("/api/refresh", { method: "POST" });
      if (!res.ok) return false;
      const body = (await res.json()) as {
        jwt?: string;
        user?: { sub: string; email?: string; name?: string; provider?: string };
      };

      // Prefer structured user info; fall back to decoding JWT for compat
      const user = body.user ?? (body.jwt ? decodeJwtPayload(body.jwt) : null);
      if (!user?.sub) return false;

      setUser({
        sub: user.sub as string,
        email: user.email as string | undefined,
        name: user.name as string | undefined,
        provider: user.provider as string | undefined,
      });

      // Schedule next silent refresh before the session cookie expires
      const remaining = body.jwt ? msUntilExpiry(body.jwt) : 50 * 60 * 1000;
      if (remaining > REFRESH_LEAD_MS) {
        scheduleRefresh(remaining - REFRESH_LEAD_MS, refresh);
      } else if (remaining > 0) {
        scheduleRefresh(0, refresh);
      }

      return true;
    } catch {
      return false;
    }
  }, [scheduleRefresh]);

  // ── Login ──────────────────────────────────────────────────
  const login = useCallback(
    async (provider: string, providerToken: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await pjFetch("/api/login", {
          method: "POST",
          body: JSON.stringify({ provider, providerToken }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Login failed (${res.status})`);
        }
        const body = (await res.json()) as {
          jwt?: string;
          user?: { sub: string; email?: string; name?: string; provider?: string };
          ok?: boolean;
        };

        // Prefer structured user; fall back to decoding JWT for compat
        const u = body.user ?? (body.jwt ? decodeJwtPayload(body.jwt) : null);
        if (u?.sub) {
          setUser({
            sub: u.sub as string,
            email: u.email as string | undefined,
            name: u.name as string | undefined,
            provider: u.provider as string | undefined,
          });
        }

        // Schedule silent refresh before the session cookie expires
        const remaining = body.jwt ? msUntilExpiry(body.jwt) : 50 * 60 * 1000;
        if (remaining > REFRESH_LEAD_MS) {
          scheduleRefresh(remaining - REFRESH_LEAD_MS, refresh);
        }

        await fetchProtectedData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchProtectedData, scheduleRefresh, refresh],
  );

  // ── Logout ─────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearRefreshTimer();
    try {
      await pjFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — clear state regardless
    }
    setUser(null);
    setManifest(null);
    setRuntimeCtx(null);
    setTiles([]);
    setError(null);
  }, [clearRefreshTimer]);

  // Clean up timer on unmount
  useEffect(() => clearRefreshTimer, [clearRefreshTimer]);

  // Attempt session restore on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check for OAuth error in URL hash
    const hash = window.location.hash;
    if (hash === "#error=authentication_failed") {
      setError("Authentication failed. Please try again.");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Clear any leftover hash (e.g. stale #access_token from old flow)
    if (hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Probe the httpOnly session cookie via /api/auth/status
    (async () => {
      try {
        const res = await pjFetch("/api/auth/status");
        if (res.ok) {
          const body = (await res.json()) as {
            authenticated: boolean;
            user: { sub: string; email?: string; name?: string; provider?: string };
          };
          if (body.authenticated && body.user?.sub) {
            setUser({
              sub: body.user.sub,
              email: body.user.email,
              name: body.user.name,
              provider: body.user.provider,
            });

            // Schedule silent refresh well before the cookie/JWT expires
            // (we don't know the exact expiry from here, so use a safe default)
            scheduleRefresh(50 * 60 * 1000, refresh); // 50 min for a 1h token

            fetchProtectedData();
            return;
          }
        }
      } catch {
        // status probe failed — fall through to silent refresh
      }

      // No valid session cookie — try silent refresh (uses pj_refresh cookie)
      const ok = await refresh();
      if (ok) fetchProtectedData();
    })();
  }, [refresh, fetchProtectedData, scheduleRefresh]);

  const value = useMemo<AuthState>(
    () => ({ user, manifest, runtimeCtx, tiles, loading, error, login, logout, refresh }),
    [user, manifest, runtimeCtx, tiles, loading, error, login, logout, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
