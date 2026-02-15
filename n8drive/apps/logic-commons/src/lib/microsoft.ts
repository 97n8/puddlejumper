// ── Microsoft (Entra ID) OAuth provider configuration ───────────────────────
import type { OAuthProvider, OAuthUserInfo } from "./oauth.js";

async function fetchMicrosoftUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Microsoft /me error ${res.status} ${txt}`);
  }
  const json = (await res.json()) as Record<string, any>;
  const id = json.id ? String(json.id) : undefined;
  if (!id) throw new Error("Missing microsoft id");
  return {
    sub: id,
    email: json.mail ?? json.userPrincipalName ?? undefined,
    name: json.displayName ?? json.mail ?? undefined,
  };
}

export const microsoftProvider: OAuthProvider = {
  name: "microsoft",
  authorizeUrl: (env) => {
    const tenantId = env.MICROSOFT_TENANT_ID || "common";
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
  },
  tokenUrl: (env) => {
    const tenantId = env.MICROSOFT_TENANT_ID || "common";
    return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  },
  scopes: "openid email profile User.Read",
  tokenContentType: "form",
  stateCookieName: "microsoft_oauth_state",
  clientIdEnvVar: "MICROSOFT_CLIENT_ID",
  clientSecretEnvVar: "MICROSOFT_CLIENT_SECRET",
  redirectUriEnvVar: "MICROSOFT_REDIRECT_URI",
  defaultRedirectUri: "http://localhost:3002/api/auth/microsoft/callback",
  extraAuthorizeParams: { response_mode: "query" },
  extraTokenParams: { scope: "openid email profile User.Read" },
  fetchUserInfo: fetchMicrosoftUserInfo,
};
