// ── Google OAuth provider configuration ─────────────────────────────────────
import type { OAuthProvider, OAuthUserInfo } from "./oauth.js";

async function fetchGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Google userinfo error ${res.status} ${txt}`);
  }
  const json = (await res.json()) as Record<string, any>;
  const id = json.id ? String(json.id) : undefined;
  if (!id) throw new Error("Missing google id");
  return {
    sub: id,
    email: json.email ?? undefined,
    name: json.name ?? json.email ?? undefined,
  };
}

export const googleProvider: OAuthProvider = {
  name: "google",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: "openid email profile",
  tokenContentType: "form",
  stateCookieName: "google_oauth_state",
  clientIdEnvVar: "GOOGLE_CLIENT_ID",
  clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
  redirectUriEnvVar: "GOOGLE_REDIRECT_URI",
  defaultRedirectUri: "http://localhost:3002/api/auth/google/callback",
  fetchUserInfo: fetchGoogleUserInfo,
};
