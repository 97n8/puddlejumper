// ── Microsoft (Entra ID) OAuth redirect flow ────────────────────────────────
import crypto from "node:crypto";
import express from "express";
import { signJwt } from "@publiclogic/core";
import type { OAuthStateStore } from "../oauthStateStore.js";

export type MicrosoftUser = { sub: string; email?: string; name?: string };

/** Verify a Microsoft access token by calling the MS Graph /me endpoint. */
async function verifyMicrosoftToken(accessToken: string): Promise<MicrosoftUser> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
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

export type MicrosoftOAuthOptions = {
  nodeEnv: string;
  oauthStateStore: OAuthStateStore;
};

export function createMicrosoftOAuthRoutes(opts: MicrosoftOAuthOptions): express.Router {
  const router = express.Router();

  // GET /api/auth/microsoft/login → redirect to Microsoft OAuth authorize
  router.get("/auth/microsoft/login", (_req, res) => {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Microsoft OAuth not configured" });
    }

    const state = opts.oauthStateStore.create("microsoft");

    const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI || "http://localhost:3002/api/auth/microsoft/callback";

    res.cookie("microsoft_oauth_state", state, {
      httpOnly: true,
      secure: opts.nodeEnv === "production",
      maxAge: 5 * 60 * 1000,
      sameSite: "lax",
    });

    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile User.Read");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("response_mode", "query");

    return res.redirect(authUrl.toString());
  });

  // GET /api/auth/microsoft/callback → exchange code, create session, redirect to frontend
  router.get("/auth/microsoft/callback", async (req, res) => {
    const { code, state, error, error_description } = req.query as {
      code?: string;
      state?: string;
      error?: string;
      error_description?: string;
    };

    // If Microsoft returned an error (e.g. user denied consent)
    if (error) {
      return res.status(400).json({ error, error_description: error_description || "Microsoft auth error" });
    }

    // Validate + consume state (single-use, SQLite-backed)
    if (!state || !opts.oauthStateStore.consume(state)) {
      return res.status(400).json({ error: "Invalid or expired state parameter" });
    }
    res.clearCookie("microsoft_oauth_state");

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      const tenantId = process.env.MICROSOFT_TENANT_ID || "common";
      const redirectUri =
        process.env.MICROSOFT_REDIRECT_URI || "http://localhost:3002/api/auth/microsoft/callback";

      // Exchange code for access token — Microsoft uses application/x-www-form-urlencoded
      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.MICROSOFT_CLIENT_ID!,
            client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
            scope: "openid email profile User.Read",
          }),
        },
      );

      const tokenBody = (await tokenResponse.json()) as Record<string, any>;
      if (tokenBody.error || !tokenBody.access_token) {
        throw new Error(
          tokenBody.error_description || tokenBody.error || "Token exchange failed",
        );
      }

      // Verify token and get user info via MS Graph
      const userInfo = await verifyMicrosoftToken(tokenBody.access_token);

      // Create access token
      const accessJwt = await signJwt(
        {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          provider: "microsoft",
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
        maxAge: 8 * 60 * 60 * 1000,
      });

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(`${frontendUrl}/#access_token=${accessJwt}`);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Microsoft OAuth callback error:", err?.message);
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(`${frontendUrl}/#error=authentication_failed`);
    }
  });

  return router;
}

