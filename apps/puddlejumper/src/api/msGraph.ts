// ── MS Graph token exchange ─────────────────────────────────────────────────
import express from "express";
import type { AuthContext } from "@publiclogic/core";
import type { MsGraphProfile, RuntimeContext } from "./types.js";
import {
  MS_GRAPH_TOKEN_HEADER,
  DEFAULT_GRAPH_PROFILE_URL,
  normalizePrincipal,
  parsePrincipalSet,
} from "./config.js";

export function extractMsGraphToken(req: express.Request): string | null {
  const rawHeader = req.get(MS_GRAPH_TOKEN_HEADER);
  if (!rawHeader) return null;
  const trimmed = rawHeader.trim();
  return trimmed || null;
}

export async function fetchMsGraphProfile(
  token: string,
  fetchImpl: typeof fetch,
): Promise<MsGraphProfile | null> {
  const response = await fetchImpl(DEFAULT_GRAPH_PROFILE_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") return null;
  return payload as MsGraphProfile;
}

export function buildMsGraphAuthContext(
  profile: MsGraphProfile,
  runtimeContext: RuntimeContext | null,
  nodeEnv: string,
): AuthContext | null {
  const principal = normalizePrincipal(profile.userPrincipalName || profile.mail);
  const profileId = typeof profile.id === "string" ? profile.id.trim() : "";
  if (!principal && !profileId) return null;

  const adminPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_ADMIN_PRINCIPALS);
  const deployPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_DEPLOY_PRINCIPALS);
  const adminFallbackPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_ADMIN_USERS);
  const deployFallbackPrincipals = parsePrincipalSet(process.env.PJ_GRAPH_DEPLOY_USERS);

  const isAdmin =
    (principal && adminPrincipals.has(principal)) ||
    (principal && adminFallbackPrincipals.has(principal));
  const explicitDeploy =
    (principal && deployPrincipals.has(principal)) ||
    (principal && deployFallbackPrincipals.has(principal));
  const canDeploy = nodeEnv === "production" ? isAdmin || explicitDeploy : true;

  const defaultWorkspaceId = runtimeContext?.workspace?.id?.trim() || "publiclogic";
  const defaultWorkspaceName = runtimeContext?.workspace?.name?.trim() || "PublicLogic";
  const defaultConnections = Array.from(
    new Set(
      (runtimeContext?.actionDefaults?.targets ?? [])
        .map((target) => String(target).split(":")[0]?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    userId: profileId || principal,
    name: (typeof profile.displayName === "string" ? profile.displayName.trim() : "") || principal || profileId,
    role: isAdmin ? "admin" : "operator",
    permissions: canDeploy ? ["deploy"] : [],
    tenants: [
      {
        id: defaultWorkspaceId,
        name: defaultWorkspaceName,
        sha: "",
        connections: defaultConnections,
      },
    ],
    tenantId: defaultWorkspaceId,
    delegations: [],
  };
}
