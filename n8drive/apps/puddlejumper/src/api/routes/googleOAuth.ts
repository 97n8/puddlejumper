// ── Google OAuth redirect flow ──────────────────────────────────────────────
import crypto from "node:crypto";
import express from "express";
import { signJwt } from "@publiclogic/core";

export type GoogleUser = { sub: string; email?: string; name?: string };

/** Verify a Google access token by calling the userinfo endpoint. */
async function verifyGoogleToken(accessToken: string): Promise<GoogleUser> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
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

// In-memory state store with 5-minute TTL
const oauthStates = new Map<string, number>();

function pruneStates() {
  const now = Date.now();
  for (const [key, exp] of oauthStates) {
    if (exp < now) oauthStates.delete(key);
  }
}

export type GoogleOAuthOptions = {
  nodeEnv: string;
};

export function createGoogleOAuthRoutes(opts: GoogleOAuthOptions): express.Router {
  const router = express.Router();

  // GET /api/auth/google/login → redirect to Google OAuth authorize
  router.get("/auth/google/login", (_req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Google OAuth not configured" });
    }

    pruneStates();
    const state = crypto.randomUUID();
    oauthStates.set(state, Date.now() + 5 * 60 * 1000);

    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI || "http://localhost:3002/api/auth/google/callback";

    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      secure: opts.nodeEnv === "production",
      maxAge: 5 * 60 * 1000,
      sameSite: "lax",
    });

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);

    return res.redirect(authUrl.toString());
  });

  // GET /api/auth/google/callback → exchange code, create session, redirect to frontend
  router.get("/auth/google/callback", async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };

    // Validate state — in-memory store is authoritative (single-use)
    const memoryValid = state && oauthStates.has(state) && oauthStates.get(state)! > Date.now();
    if (!state || !memoryValid) {
      return res.status(400).json({ error: "Invalid or expired state parameter" });
    }

    // Consume state (one-time use)
    oauthStates.delete(state);
    res.clearCookie("google_oauth_state");

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      // Exchange code for access token — server-side, secret never exposed
      // Google uses application/x-www-form-urlencoded for token exchange
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          code,
          redirect_uri:
            process.env.GOOGLE_REDIRECT_URI || "http://localhost:3002/api/auth/google/callback",
          grant_type: "authorization_code",
        }),
      });

      const tokenBody = (await tokenResponse.json()) as Record<string, any>;
      if (tokenBody.error || !tokenBody.access_token) {
        throw new Error(tokenBody.error_description || tokenBody.error || "Token exchange failed");
      }

      // Verify token and get user info
      const userInfo = await verifyGoogleToken(tokenBody.access_token);

      // Create access token
      const accessJwt = await signJwt(
        {
          sub: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          provider: "google",
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

      // Redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(`${frontendUrl}/#access_token=${accessJwt}`);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error("Google OAuth callback error:", err?.message);
      const frontendUrl = process.env.FRONTEND_URL || "https://pj.publiclogic.org";
      return res.redirect(`${frontendUrl}/#error=authentication_failed`);
    }
  });

  return router;
}

// Export for testing
export { oauthStates as _googleOauthStates };
