// ── GitHub OAuth provider configuration ─────────────────────────────────────
import type { OAuthProvider, OAuthUserInfo } from "./oauth.js";

async function fetchGitHubUserInfo(accessToken: string): Promise<OAuthUserInfo> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": "PuddleJumper/OAuth",
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub /user error ${res.status} ${txt}`);
  }
  const json = (await res.json()) as Record<string, any>;
  const id = json.id ? String(json.id) : undefined;
  if (!id) throw new Error("Missing github id");
  return {
    sub: id,
    email: json.email ?? `${json.login}@users.noreply.github.com`,
    name: json.name ?? json.login,
  };
}

export const githubProvider: OAuthProvider = {
  name: "github",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scopes: "user:email",
  tokenContentType: "json",
  stateCookieName: "oauth_state",
  clientIdEnvVar: "GITHUB_CLIENT_ID",
  clientSecretEnvVar: "GITHUB_CLIENT_SECRET",
  redirectUriEnvVar: "GITHUB_REDIRECT_URI",
  defaultRedirectUri: "http://localhost:3002/api/auth/github/callback",
  fetchHeaders: { "User-Agent": "PuddleJumper/OAuth" },
  fetchUserInfo: fetchGitHubUserInfo,
};
