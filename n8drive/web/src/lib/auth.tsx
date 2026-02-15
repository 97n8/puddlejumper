"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  operator?: string;
} | null;

type AuthState = {
  user: User;
  manifest: CapabilityManifest;
  runtimeCtx: RuntimeContext;
  loading: boolean;
  error: string | null;
  login: (provider: string, providerToken: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<boolean>;
};

const AuthCtx = createContext<AuthState>({
  user: null,
  manifest: null,
  runtimeCtx: null,
  loading: false,
  error: null,
  login: async () => {},
  logout: () => {},
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

// ── Provider ───────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [manifest, setManifest] = useState<CapabilityManifest>(null);
  const [runtimeCtx, setRuntimeCtx] = useState<RuntimeContext>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch manifest + runtime context once authenticated
  const fetchProtectedData = useCallback(async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        pjFetch("/api/capabilities/manifest"),
        pjFetch("/api/runtime/context"),
      ]);
      if (mRes.ok) setManifest(await mRes.json());
      if (cRes.ok) setRuntimeCtx(await cRes.json());
    } catch {
      // non-fatal — tiles will just show as unavailable
    }
  }, []);

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
        const { jwt } = (await res.json()) as { jwt: string };
        const payload = decodeJwtPayload(jwt);
        setUser({
          sub: payload.sub as string,
          email: payload.email as string | undefined,
          name: payload.name as string | undefined,
          provider: payload.provider as string | undefined,
        });
        await fetchProtectedData();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchProtectedData],
  );

  // ── Refresh ────────────────────────────────────────────────
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await pjFetch("/api/refresh", { method: "POST" });
      if (!res.ok) return false;
      const { jwt } = (await res.json()) as { jwt: string };
      const payload = decodeJwtPayload(jwt);
      setUser({
        sub: payload.sub as string,
        email: payload.email as string | undefined,
        name: payload.name as string | undefined,
        provider: payload.provider as string | undefined,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    setManifest(null);
    setRuntimeCtx(null);
    setError(null);
  }, []);

  // Attempt silent refresh on mount (if refresh cookie exists)
  useEffect(() => {
    refresh().then((ok) => {
      if (ok) fetchProtectedData();
    });
  }, [refresh, fetchProtectedData]);

  const value = useMemo<AuthState>(
    () => ({ user, manifest, runtimeCtx, loading, error, login, logout, refresh }),
    [user, manifest, runtimeCtx, loading, error, login, logout, refresh],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
