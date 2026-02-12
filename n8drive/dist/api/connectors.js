import crypto from "node:crypto";
import { URLSearchParams } from "node:url";
import express from "express";
import { z } from "zod";
import { getAuthContext } from "./auth.js";
const providerSchema = z.enum(["microsoft", "google", "github"]);
const callbackQuerySchema = z
    .object({
    code: z.string().trim().min(1),
    state: z.string().trim().min(1)
})
    .strict();
const resourceQuerySchema = z
    .object({
    q: z.string().trim().max(256).optional()
})
    .strict();
function splitScopes(value) {
    if (!value) {
        return [];
    }
    return value
        .split(/\s+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function parseBearerExpiresAt(expiresInSeconds) {
    if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
        return null;
    }
    return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
function isTokenValid(record) {
    if (!record) {
        return false;
    }
    if (!record.expiresAt) {
        return true;
    }
    const expiresAtMs = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
        return false;
    }
    return Date.now() + 15_000 < expiresAtMs;
}
function verifyProvider(value) {
    const parsed = providerSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}
function createStateSigner(secret) {
    const trimmedSecret = secret.trim();
    if (!trimmedSecret) {
        throw new Error("CONNECTOR_STATE_SECRET is required");
    }
    return {
        sign(payload) {
            const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
            const signature = crypto.createHmac("sha256", trimmedSecret).update(encoded).digest("base64url");
            return `${encoded}.${signature}`;
        },
        verify(rawState) {
            const parts = rawState.split(".");
            if (parts.length !== 2) {
                return null;
            }
            const [encoded, signature] = parts;
            if (!encoded || !signature) {
                return null;
            }
            const expected = crypto.createHmac("sha256", trimmedSecret).update(encoded).digest("base64url");
            const signatureBuffer = Buffer.from(signature);
            const expectedBuffer = Buffer.from(expected);
            if (signatureBuffer.length !== expectedBuffer.length) {
                return null;
            }
            if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
                return null;
            }
            try {
                const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
                const stateSchema = z
                    .object({
                    tenantId: z.string().trim().min(1).max(128),
                    userId: z.string().trim().min(1).max(128),
                    provider: providerSchema,
                    nonce: z.string().trim().min(8).max(128),
                    exp: z.number().int().positive()
                })
                    .strict();
                const validated = stateSchema.safeParse(parsed);
                return validated.success ? validated.data : null;
            }
            catch {
                return null;
            }
        }
    };
}
async function parseJsonResponse(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return response.json().catch(() => null);
    }
    return response.text().catch(() => "");
}
async function exchangeAuthorizationCode(fetchImpl, url, form, headers = {}) {
    const response = await fetchImpl(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...headers
        },
        body: form.toString()
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object") {
        const detail = payload && typeof payload === "object" && "error_description" in payload
            ? String(payload.error_description)
            : `OAuth token exchange failed (${response.status})`;
        throw new Error(detail);
    }
    return payload;
}
async function getJsonWithBearer(fetchImpl, url, accessToken, headers = {}) {
    const response = await fetchImpl(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...headers
        }
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || !payload || typeof payload !== "object") {
        const detail = payload && typeof payload === "object" && "message" in payload
            ? String(payload.message)
            : `Connector API request failed (${response.status})`;
        throw new Error(detail);
    }
    return payload;
}
function getMicrosoftAdapter(tenantId, userId, store, fetchImpl) {
    const tenantSegment = (process.env.MS_TENANT_ID ?? "common").trim() || "common";
    const clientId = (process.env.MS_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.MS_CLIENT_SECRET ?? "").trim();
    const scope = (process.env.MS_SCOPE ??
        "offline_access Files.Read Sites.Read.All Mail.Read Calendars.Read User.Read")
        .trim()
        .replace(/\s+/g, " ");
    const ensureConfigured = () => {
        if (!clientId || !clientSecret) {
            throw new Error("Microsoft connector is not configured");
        }
    };
    return {
        provider: "microsoft",
        async getStatus() {
            const token = store.getToken("microsoft", tenantId, userId);
            return {
                connected: isTokenValid(token),
                account: token?.account ?? null,
                scopes: token?.scopes ?? [],
                expiresAt: token?.expiresAt ?? null
            };
        },
        getAuthUrl(signedState, redirectUri) {
            ensureConfigured();
            const query = new URLSearchParams({
                client_id: clientId,
                response_type: "code",
                redirect_uri: redirectUri,
                response_mode: "query",
                scope,
                state: signedState
            });
            return `https://login.microsoftonline.com/${encodeURIComponent(tenantSegment)}/oauth2/v2.0/authorize?${query.toString()}`;
        },
        async handleCallback(code, redirectUri) {
            ensureConfigured();
            const form = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                scope
            });
            const tokenPayload = await exchangeAuthorizationCode(fetchImpl, `https://login.microsoftonline.com/${encodeURIComponent(tenantSegment)}/oauth2/v2.0/token`, form);
            const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
            if (!accessToken) {
                throw new Error("Microsoft token response missing access_token");
            }
            const refreshToken = typeof tokenPayload.refresh_token === "string" ? tokenPayload.refresh_token : null;
            const expiresAt = parseBearerExpiresAt(tokenPayload.expires_in);
            const grantedScopes = splitScopes(typeof tokenPayload.scope === "string" ? tokenPayload.scope : scope);
            const profile = await getJsonWithBearer(fetchImpl, "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName", accessToken);
            const account = [
                typeof profile.userPrincipalName === "string" ? profile.userPrincipalName : "",
                typeof profile.mail === "string" ? profile.mail : "",
                typeof profile.displayName === "string" ? profile.displayName : ""
            ].find((candidate) => candidate.trim().length > 0) ?? null;
            store.upsertToken({
                provider: "microsoft",
                tenantId,
                userId,
                account,
                scopes: grantedScopes,
                accessToken,
                refreshToken,
                expiresAt
            });
        },
        async disconnect() {
            store.clearToken("microsoft", tenantId, userId);
        },
        async searchResources(query) {
            const token = store.getToken("microsoft", tenantId, userId);
            if (!token || !isTokenValid(token)) {
                throw new Error("Not connected");
            }
            const normalizedQuery = query.trim();
            const endpoint = normalizedQuery.length > 0
                ? `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(normalizedQuery.replace(/'/g, "''"))}')?$top=25&$select=id,name,webUrl,folder,file`
                : "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=25&$select=id,name,webUrl,folder,file";
            const payload = await getJsonWithBearer(fetchImpl, endpoint, token.accessToken);
            const rawValues = Array.isArray(payload.value) ? payload.value : [];
            return rawValues
                .filter((entry) => Boolean(entry && typeof entry === "object"))
                .map((entry) => ({
                id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
                name: typeof entry.name === "string" ? entry.name : "Untitled",
                type: entry.folder && typeof entry.folder === "object"
                    ? "folder"
                    : entry.file && typeof entry.file === "object"
                        ? "file"
                        : "record",
                url: typeof entry.webUrl === "string" ? entry.webUrl : null,
                provider: "microsoft"
            }));
        }
    };
}
function getGoogleAdapter(tenantId, userId, store, fetchImpl) {
    const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
    const scope = (process.env.GOOGLE_SCOPE ??
        "openid email profile https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly")
        .trim()
        .replace(/\s+/g, " ");
    const ensureConfigured = () => {
        if (!clientId || !clientSecret) {
            throw new Error("Google connector is not configured");
        }
    };
    return {
        provider: "google",
        async getStatus() {
            const token = store.getToken("google", tenantId, userId);
            return {
                connected: isTokenValid(token),
                account: token?.account ?? null,
                scopes: token?.scopes ?? [],
                expiresAt: token?.expiresAt ?? null
            };
        },
        getAuthUrl(signedState, redirectUri) {
            ensureConfigured();
            const query = new URLSearchParams({
                client_id: clientId,
                response_type: "code",
                redirect_uri: redirectUri,
                scope,
                access_type: "offline",
                include_granted_scopes: "true",
                prompt: "consent",
                state: signedState
            });
            return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
        },
        async handleCallback(code, redirectUri) {
            ensureConfigured();
            const form = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri
            });
            const tokenPayload = await exchangeAuthorizationCode(fetchImpl, "https://oauth2.googleapis.com/token", form);
            const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
            if (!accessToken) {
                throw new Error("Google token response missing access_token");
            }
            const refreshToken = typeof tokenPayload.refresh_token === "string" ? tokenPayload.refresh_token : null;
            const expiresAt = parseBearerExpiresAt(tokenPayload.expires_in);
            const grantedScopes = splitScopes(typeof tokenPayload.scope === "string" ? tokenPayload.scope : scope);
            const profile = await getJsonWithBearer(fetchImpl, "https://www.googleapis.com/oauth2/v2/userinfo", accessToken);
            const account = [
                typeof profile.email === "string" ? profile.email : "",
                typeof profile.name === "string" ? profile.name : ""
            ].find((candidate) => candidate.trim().length > 0) ?? null;
            store.upsertToken({
                provider: "google",
                tenantId,
                userId,
                account,
                scopes: grantedScopes,
                accessToken,
                refreshToken,
                expiresAt
            });
        },
        async disconnect() {
            store.clearToken("google", tenantId, userId);
        },
        async searchResources(query) {
            const token = store.getToken("google", tenantId, userId);
            if (!token || !isTokenValid(token)) {
                throw new Error("Not connected");
            }
            const normalizedQuery = query.trim();
            const driveQuery = normalizedQuery.length > 0
                ? `name contains '${normalizedQuery.replace(/'/g, "\\'")}' and trashed=false`
                : "trashed=false";
            const url = `https://www.googleapis.com/drive/v3/files?pageSize=25&fields=files(id,name,mimeType,webViewLink)&q=${encodeURIComponent(driveQuery)}`;
            const payload = await getJsonWithBearer(fetchImpl, url, token.accessToken);
            const files = Array.isArray(payload.files) ? payload.files : [];
            return files
                .filter((entry) => Boolean(entry && typeof entry === "object"))
                .map((entry) => ({
                id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
                name: typeof entry.name === "string" ? entry.name : "Untitled",
                type: typeof entry.mimeType === "string" && entry.mimeType === "application/vnd.google-apps.folder"
                    ? "folder"
                    : "file",
                url: typeof entry.webViewLink === "string" ? entry.webViewLink : null,
                provider: "google"
            }));
        }
    };
}
function getGitHubAdapter(tenantId, userId, store, fetchImpl) {
    const clientId = (process.env.GITHUB_CLIENT_ID ?? "").trim();
    const clientSecret = (process.env.GITHUB_CLIENT_SECRET ?? "").trim();
    const scope = (process.env.GITHUB_SCOPE ?? "read:user repo").trim().replace(/\s+/g, " ");
    const ensureConfigured = () => {
        if (!clientId || !clientSecret) {
            throw new Error("GitHub connector is not configured");
        }
    };
    return {
        provider: "github",
        async getStatus() {
            const token = store.getToken("github", tenantId, userId);
            return {
                connected: isTokenValid(token),
                account: token?.account ?? null,
                scopes: token?.scopes ?? [],
                expiresAt: token?.expiresAt ?? null
            };
        },
        getAuthUrl(signedState, redirectUri) {
            ensureConfigured();
            const query = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                scope,
                state: signedState
            });
            return `https://github.com/login/oauth/authorize?${query.toString()}`;
        },
        async handleCallback(code, redirectUri) {
            ensureConfigured();
            const form = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: redirectUri
            });
            const tokenPayload = await exchangeAuthorizationCode(fetchImpl, "https://github.com/login/oauth/access_token", form, { Accept: "application/json" });
            const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
            if (!accessToken) {
                throw new Error("GitHub token response missing access_token");
            }
            const grantedScopes = splitScopes(typeof tokenPayload.scope === "string" && tokenPayload.scope.trim() ? tokenPayload.scope : scope);
            const profile = await getJsonWithBearer(fetchImpl, "https://api.github.com/user", accessToken, {
                Accept: "application/vnd.github+json",
                "User-Agent": "puddle-jumper-connectors"
            });
            const account = typeof profile.login === "string" ? profile.login : null;
            store.upsertToken({
                provider: "github",
                tenantId,
                userId,
                account,
                scopes: grantedScopes,
                accessToken,
                refreshToken: null,
                expiresAt: null
            });
        },
        async disconnect() {
            store.clearToken("github", tenantId, userId);
        },
        async searchResources(query) {
            const token = store.getToken("github", tenantId, userId);
            if (!token || !isTokenValid(token)) {
                throw new Error("Not connected");
            }
            const normalizedQuery = query.trim();
            const searchQuery = normalizedQuery.length > 0 ? `${normalizedQuery} in:name,description` : "is:public";
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&per_page=25`;
            const payload = await getJsonWithBearer(fetchImpl, url, token.accessToken, {
                Accept: "application/vnd.github+json",
                "User-Agent": "puddle-jumper-connectors"
            });
            const items = Array.isArray(payload.items) ? payload.items : [];
            return items
                .filter((entry) => Boolean(entry && typeof entry === "object"))
                .map((entry) => ({
                id: typeof entry.id === "number" ? String(entry.id) : crypto.randomUUID(),
                name: typeof entry.full_name === "string" ? entry.full_name : "repository",
                type: "repo",
                url: typeof entry.html_url === "string" ? entry.html_url : null,
                provider: "github"
            }));
        }
    };
}
function resolveBaseUrl(req) {
    const configuredBaseUrl = (process.env.CONNECTOR_PUBLIC_BASE_URL ?? process.env.BASE_URL ?? "").trim();
    if (configuredBaseUrl) {
        try {
            const parsed = new URL(configuredBaseUrl);
            if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                return parsed.origin;
            }
        }
        catch {
            // Fall through to request-derived base URL.
        }
    }
    const forwardedProtoHeader = req.get("x-forwarded-proto");
    const protocol = forwardedProtoHeader ? forwardedProtoHeader.split(",")[0].trim() : req.protocol;
    const forwardedHostHeader = req.get("x-forwarded-host");
    const host = forwardedHostHeader ? forwardedHostHeader.split(",")[0].trim() : req.get("host");
    const safeHost = host && host.trim() ? host.trim() : "localhost:3002";
    const safeProtocol = protocol === "https" ? "https" : "http";
    return `${safeProtocol}://${safeHost}`;
}
function buildAdapter(provider, tenantId, userId, store, fetchImpl) {
    if (provider === "microsoft") {
        return getMicrosoftAdapter(tenantId, userId, store, fetchImpl);
    }
    if (provider === "google") {
        return getGoogleAdapter(tenantId, userId, store, fetchImpl);
    }
    return getGitHubAdapter(tenantId, userId, store, fetchImpl);
}
function requireAuthContext(req, res) {
    const auth = getAuthContext(req);
    if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
    }
    return auth;
}
export function createConnectorsRouter(options) {
    const router = express.Router();
    const fetchImpl = options.fetchImpl ?? fetch;
    const signer = createStateSigner(options.stateHmacKey);
    router.get("/", async (req, res) => {
        const auth = requireAuthContext(req, res);
        if (!auth) {
            return;
        }
        const tenantId = auth.tenantId ?? "";
        if (!tenantId) {
            res.status(400).json({ error: "Tenant scope unavailable" });
            return;
        }
        const providers = ["microsoft", "google", "github"];
        const statuses = await Promise.all(providers.map(async (provider) => {
            const adapter = buildAdapter(provider, tenantId, auth.userId, options.store, fetchImpl);
            const status = await adapter.getStatus();
            return [
                provider,
                {
                    provider,
                    connected: status.connected,
                    account: status.account,
                    scopes: status.scopes,
                    expiresAt: status.expiresAt,
                    tenantId,
                    updatedAt: new Date().toISOString()
                }
            ];
        }));
        res.status(200).json({
            tenantId,
            userId: auth.userId,
            connectors: Object.fromEntries(statuses)
        });
    });
    router.post("/:provider/auth/start", (req, res) => {
        const auth = requireAuthContext(req, res);
        if (!auth) {
            return;
        }
        const provider = verifyProvider(String(req.params.provider ?? ""));
        if (!provider) {
            res.status(400).json({ error: "Invalid provider" });
            return;
        }
        const tenantId = auth.tenantId ?? "";
        if (!tenantId) {
            res.status(400).json({ error: "Tenant scope unavailable" });
            return;
        }
        const adapter = buildAdapter(provider, tenantId, auth.userId, options.store, fetchImpl);
        const signedState = signer.sign({
            tenantId,
            userId: auth.userId,
            provider,
            nonce: crypto.randomUUID(),
            exp: Date.now() + 10 * 60_000
        });
        const redirectUri = `${resolveBaseUrl(req)}/api/connectors/${provider}/auth/callback`;
        try {
            const authUrl = adapter.getAuthUrl(signedState, redirectUri);
            res.status(200).json({
                authUrl,
                state: signedState
            });
        }
        catch (error) {
            res.status(503).json({
                error: error instanceof Error ? error.message : "Connector unavailable"
            });
        }
    });
    router.get("/:provider/auth/callback", async (req, res) => {
        const provider = verifyProvider(String(req.params.provider ?? ""));
        if (!provider) {
            res.status(400).send("Invalid provider");
            return;
        }
        const parsedQuery = callbackQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            res.status(400).send("Missing code or state");
            return;
        }
        const state = signer.verify(parsedQuery.data.state);
        if (!state || state.provider !== provider || state.exp < Date.now()) {
            res.status(400).send("Invalid or expired state");
            return;
        }
        const adapter = buildAdapter(provider, state.tenantId, state.userId, options.store, fetchImpl);
        const redirectUri = `${resolveBaseUrl(req)}/api/connectors/${provider}/auth/callback`;
        try {
            await adapter.handleCallback(parsedQuery.data.code, redirectUri);
            res.redirect(302, `/pj?connected=${encodeURIComponent(provider)}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "OAuth failed";
            res.status(500).send(`OAuth failed: ${message}`);
        }
    });
    router.post("/:provider/disconnect", async (req, res) => {
        const auth = requireAuthContext(req, res);
        if (!auth) {
            return;
        }
        const provider = verifyProvider(String(req.params.provider ?? ""));
        if (!provider) {
            res.status(400).json({ error: "Invalid provider" });
            return;
        }
        const tenantId = auth.tenantId ?? "";
        if (!tenantId) {
            res.status(400).json({ error: "Tenant scope unavailable" });
            return;
        }
        const adapter = buildAdapter(provider, tenantId, auth.userId, options.store, fetchImpl);
        await adapter.disconnect();
        res.status(200).json({ success: true });
    });
    router.get("/:provider/resources", async (req, res) => {
        const auth = requireAuthContext(req, res);
        if (!auth) {
            return;
        }
        const provider = verifyProvider(String(req.params.provider ?? ""));
        if (!provider) {
            res.status(400).json({ error: "Invalid provider" });
            return;
        }
        const parsedQuery = resourceQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            res.status(400).json({ error: "Invalid query payload" });
            return;
        }
        const tenantId = auth.tenantId ?? "";
        if (!tenantId) {
            res.status(400).json({ error: "Tenant scope unavailable" });
            return;
        }
        const adapter = buildAdapter(provider, tenantId, auth.userId, options.store, fetchImpl);
        const status = await adapter.getStatus();
        if (!status.connected) {
            res.status(401).json({ error: "Not connected" });
            return;
        }
        try {
            const resources = await adapter.searchResources(parsedQuery.data.q ?? "");
            res.status(200).json({ results: resources });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Connector request failed";
            if (/not connected|authentication|unauthorized/i.test(message)) {
                res.status(401).json({ error: "Not connected" });
                return;
            }
            res.status(502).json({ error: "Connector request failed" });
        }
    });
    return router;
}
