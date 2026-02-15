// ── GitHub OAuth redirect flow ──────────────────────────────────────────────
import crypto from "node:crypto";
import express from "express";
import { signJwt } from "@publiclogic/core";
import type { OAuthStateStore } from "../oauthStateStore.js";

export type GitHubUser = { sub: string; email?: string; name?: string; login?: string };

/** Verify a GitHub access token by calling /user. */
async function verifyGitHubToken(accessToken: string): Promise<GitHubUser> {
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
    login: json.login,
  };
}

export type GitHubOAuthOptions = {
  nodeEnv: string;
  oauthStateStore: OAuthStateStore;
};

export function createGitHubOAuthRoutes(opts: GitHubOAuthOptions): express.Router {
  const router = express.Router();

  // GET /api/auth/github/login → redirect to GitHub OAuth authorize
  router.get("/auth/github/login", (_req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "GitHub OAuth not configured" });
    }

    const state = opts.oauthStateStore.create("github");

    const redirectUri =
      process.env.GITHUB_REDIRECT_URI || "http://localhost:3002/api/auth/github/callback";

    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: opts.nodeEnv === "production",
      maxAge: 5 * 60 * 1000,
      sameSite: "lax",
    });

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", "user:email");

    return res.redirect(authUrl.toString());
  });

  // GET /api/auth/github/callback → exchange code, create session, redirect to frontend
  router.get("/auth/github/callback", async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };

    // Validate + consume state (single-use, SQLite-backed)
    if (!state || !opts.oauthStateStore.consume(state)) {
      return res.status(400).json({ error: "Invalid or expired state parameter" });
    }
    res.clearCookie("oauth_state");

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      // Exchange code for access token — server-side, secret never exposed
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri:
            process.env.GITHUB_REDIRECT_URI || "http://localhost:3002/api/auth/github/callback",
        }),
      });

      const tokenBody = (await tokenResponse.json()) as Record<string, any>;
      if (tokenBody.error || !tokenBody.access_token) {
        throw new Error(tokenBody.error_description || tokenBody.error || "Token exchange failed");
      }

      // Verify token and get user info
      const userInfo = await verifyGitHubToken(tokenBody.access_token);

      // Create access token
      const accessJwt = await signJwt(
        {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          provider: "github",
          role: "user",
        },
        { expiresIn: "8h" },
      );

      // Set session cookie
      res.cookie("jwt", accessJwt, {
        httpOnly: true,
        secure: opts.nodeEnv === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });

      // Redirect to frontend (cookie carries the session — no token in URL)
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(frontendUrl);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("GitHub OAuth callback error:", err?.message);
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(`${frontendUrl}/#error=authentication_failed`);
    }
  });

  return router;
}

