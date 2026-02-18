// ── PuddleJumper SSO bridge ─────────────────────────────────────────────────
//
// After the OS authenticates with MSAL, this module exchanges the Microsoft
// access token with PuddleJumper's /api/auth/token-exchange endpoint.
// This creates httpOnly session cookies so the user can navigate to PJ
// without logging in again.

import { getConfig } from "./config.js";

/**
 * Exchange the current MSAL access token with PuddleJumper to establish
 * a PJ session.  Returns the PJ user object on success, or null on failure.
 *
 * @param {import("./auth.js").ReturnType<typeof import("./auth.js").createAuth>} auth
 *   The auth object from createAuth().
 */
export async function establishPjSession(auth) {
  const cfg = getConfig();
  const pjUrl = cfg.puddlejumper?.apiUrl;
  if (!pjUrl) return null;

  let tokenResult;
  try {
    // Acquire a Microsoft token silently — the OS already has one.
    // We request User.Read which PJ's microsoft provider needs.
    tokenResult = await auth.acquireToken(["User.Read"]);
  } catch {
    return null;
  }
  if (!tokenResult?.accessToken) return null;

  try {
    const res = await fetch(`${pjUrl}/api/auth/token-exchange`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-PuddleJumper-Request": "true"
      },
      body: JSON.stringify({
        provider: "microsoft",
        accessToken: tokenResult.accessToken
      })
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.ok ? body.user : null;
  } catch {
    return null;
  }
}

/**
 * Check if there's already a valid PJ session by probing /api/session.
 * Returns the user object or null.
 */
export async function checkPjSession() {
  const cfg = getConfig();
  const pjUrl = cfg.puddlejumper?.apiUrl;
  if (!pjUrl) return null;

  try {
    const res = await fetch(`${pjUrl}/api/session`, {
      credentials: "include"
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.ok ? body.user : null;
  } catch {
    return null;
  }
}
