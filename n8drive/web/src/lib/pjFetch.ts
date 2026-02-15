const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Attempt a silent refresh by calling POST /api/refresh.
 * Returns true if the refresh succeeded (new access JWT issued).
 */
let _refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  // Dedup concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-PuddleJumper-Request": "true",
        },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

/**
 * Fetch wrapper that automatically:
 * - Prefixes the API base URL
 * - Sends credentials (cookies) with every request
 * - Adds the X-PuddleJumper-Request CSRF header on mutating methods
 * - On 401, attempts a silent refresh and retries once
 */
export async function pjFetch(
  path: string,
  opts: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(opts.headers);

  // Always send JSON content-type for mutating requests unless already set
  if (
    opts.method &&
    MUTATING_METHODS.has(opts.method.toUpperCase()) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // CSRF header — required by the server for all mutating API calls
  if (opts.method && MUTATING_METHODS.has(opts.method.toUpperCase())) {
    headers.set("X-PuddleJumper-Request", "true");
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...opts,
    credentials: "include",
    headers,
  });

  // On 401, attempt a silent token refresh and retry the original request once.
  // Skip retry for refresh/login/logout endpoints to avoid infinite loops.
  if (
    response.status === 401 &&
    !path.startsWith("/api/refresh") &&
    !path.startsWith("/api/login") &&
    !path.startsWith("/api/auth/logout")
  ) {
    const refreshed = await silentRefresh();
    if (refreshed) {
      // Retry original request with fresh credentials
      return fetch(`${API_URL}${path}`, {
        ...opts,
        credentials: "include",
        headers,
      });
    }
  }

  return response;
}
