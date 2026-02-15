const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Fetch wrapper that automatically:
 * - Prefixes the API base URL
 * - Sends credentials (cookies) with every request
 * - Adds the X-PuddleJumper-Request CSRF header on mutating methods
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

  return fetch(`${API_URL}${path}`, {
    ...opts,
    credentials: "include",
    headers,
  });
}
