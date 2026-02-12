import { applyIdentityContext, isTrustedOriginFromList } from "./internal-src/pj-popout-security.js";

const omnisearch = document.getElementById('omnisearch');
const resultsContainer = document.getElementById('results');
const emptyState = document.getElementById('emptyState');
const resultCount = document.getElementById('resultCount');
const tenantSelect = document.getElementById('tenantSelect');
const connectionsList = document.getElementById('connectionsList');
const operatorName = document.getElementById('operatorName');
const connectorStatusPanel = document.getElementById('connectorStatusPanel');

const CAPABILITY_KEYS = {
    POPUP_LAUNCH: 'popout.launch',
    CAPABILITIES_READ: 'missionControl.capabilities.read'
};

const TOKEN_REFRESH_EARLY_MS = 30 * 1000;
const DEV_TRACE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

function normalizeOrigin(value) {
    try {
        const parsed = new URL(String(value), window.location.origin);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "";
        }
        return parsed.origin;
    } catch {
        return "";
    }
}

function resolveInitialTrustedOrigins() {
    const origins = new Set();
    const localOrigin = normalizeOrigin(window.location.origin);
    if (localOrigin) {
        origins.add(localOrigin);
    }
    const referrerOrigin = normalizeOrigin(document.referrer || "");
    if (referrerOrigin) {
        origins.add(referrerOrigin);
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        origins.add("http://localhost:3000");
        origins.add("http://127.0.0.1:3000");
    }
    return Array.from(origins);
}

const state = {
    trustedOrigins: resolveInitialTrustedOrigins(),
    tenants: [],
    connectionsByTenant: {},
    identityLoaded: false,
    authToken: "",
    authTokenExpiresAt: 0,
    authTokenRefreshPromise: null,
    apiBaseOrigin: normalizeOrigin(window.location.origin) || window.location.origin,
    manifest: null,
    capabilities: null,
    capabilitiesPromise: null,
    connectorStatuses: {}
};
const CONNECTOR_PROVIDER_ORDER = ['microsoft', 'google', 'github'];
const connectorAuthPollers = {};

function setApiBaseOrigin(value) {
    const normalized = normalizeOrigin(value);
    if (!normalized) {
        return false;
    }
    state.apiBaseOrigin = normalized;
    return true;
}

function resolveApiUrl(path) {
    const target = String(path || "");
    if (/^https?:\/\//i.test(target)) {
        return target;
    }
    const normalizedPath = target.startsWith("/") ? target : `/${target}`;
    return `${state.apiBaseOrigin}${normalizedPath}`;
}

function alignApiBaseWithParentContext() {
    if (window.parent === window) {
        setApiBaseOrigin(window.location.origin);
        return;
    }
    const referrerOrigin = normalizeOrigin(document.referrer || "");
    if (referrerOrigin && isTrustedOriginFromList(referrerOrigin, state.trustedOrigins)) {
        setApiBaseOrigin(referrerOrigin);
        return;
    }
    setApiBaseOrigin(window.location.origin);
}

function resolveParentMessageOrigins() {
    const referrerOrigin = normalizeOrigin(document.referrer || "");
    if (referrerOrigin && isTrustedOriginFromList(referrerOrigin, state.trustedOrigins)) {
        return [referrerOrigin];
    }
    const localOrigin = normalizeOrigin(window.location.origin);
    const localHost = (() => {
        try {
            return new URL(window.location.origin).hostname;
        } catch {
            return "";
        }
    })();
    const nonLocalOrigins = state.trustedOrigins.filter((origin) => origin && origin !== localOrigin);
    const sameHostOrigins = nonLocalOrigins.filter((origin) => {
        try {
            return localHost && new URL(origin).hostname === localHost;
        } catch {
            return false;
        }
    });
    return sameHostOrigins.length > 0 ? sameHostOrigins : nonLocalOrigins;
}

function normalizeAuthorizationHeader(value) {
    if (typeof value !== "string") {
        return "";
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return "";
    }
    return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

function extractRelayToken(payload) {
    if (!payload || typeof payload !== "object") {
        return "";
    }
    const candidates = [payload.pjToken, payload.accessToken, payload.token, payload.authorization];
    for (const candidate of candidates) {
        const normalized = normalizeAuthorizationHeader(candidate);
        if (normalized) {
            return normalized;
        }
    }
    return "";
}

function clearAuthToken() {
    state.authToken = "";
    state.authTokenExpiresAt = 0;
}

function extractBearerToken(value) {
    const normalized = normalizeAuthorizationHeader(value);
    if (!normalized) {
        return "";
    }
    return normalized.replace(/^Bearer\s+/i, "").trim();
}

function decodeJwtPayload(value) {
    try {
        const token = extractBearerToken(value);
        if (!token) {
            return null;
        }
        const parts = token.split(".");
        if (parts.length < 2 || !parts[1]) {
            return null;
        }
        const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function resolveTokenExpiryMs(payload, tokenValue) {
    if (payload && typeof payload === "object") {
        if (typeof payload.expires_at === "string") {
            const parsed = Date.parse(payload.expires_at);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }
        if (typeof payload.expires_in === "number" && Number.isFinite(payload.expires_in) && payload.expires_in > 0) {
            return Date.now() + payload.expires_in * 1000;
        }
    }
    const jwtPayload = decodeJwtPayload(tokenValue);
    if (jwtPayload && typeof jwtPayload.exp === "number" && Number.isFinite(jwtPayload.exp) && jwtPayload.exp > 0) {
        return jwtPayload.exp * 1000;
    }
    return 0;
}

function setAuthToken(value, expiryMs) {
    const normalized = normalizeAuthorizationHeader(value);
    if (!normalized) {
        return false;
    }
    const resolvedExpiry = Number.isFinite(expiryMs) && expiryMs > 0 ? expiryMs : resolveTokenExpiryMs(null, normalized);
    if (state.authToken === normalized && state.authTokenExpiresAt === resolvedExpiry) {
        return false;
    }
    state.authToken = normalized;
    state.authTokenExpiresAt = resolvedExpiry || 0;
    return true;
}

function isAuthTokenExpiringSoon() {
    return !state.authTokenExpiresAt || Date.now() >= state.authTokenExpiresAt - TOKEN_REFRESH_EARLY_MS;
}

function traceTokenBootstrap(payload) {
    if (!DEV_TRACE || !payload || typeof payload !== "object") {
        return;
    }
    const correlationId = typeof payload.correlationId === "string" ? payload.correlationId : "";
    if (!correlationId) {
        return;
    }
    // eslint-disable-next-line no-console
    console.debug("[PJ Popout]", "token-bootstrap", correlationId);
}

async function refreshAuthToken(force = false) {
    if (!force && state.authToken && !isAuthTokenExpiringSoon()) {
        return true;
    }
    if (state.authTokenRefreshPromise) {
        return state.authTokenRefreshPromise;
    }

    state.authTokenRefreshPromise = (async () => {
        try {
            const response = await fetch(resolveApiUrl("/api/pj/identity-token"), {
                method: "GET",
                credentials: "include",
                headers: { "X-PuddleJumper-Request": "true" }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    clearAuthToken();
                }
                return false;
            }
            const payload = await response.json().catch(() => null);
            traceTokenBootstrap(payload);
            const token = payload && typeof payload === "object" ? payload.token : null;
            const expiryMs = resolveTokenExpiryMs(payload, token);
            return setAuthToken(token, expiryMs);
        } catch {
            return false;
        } finally {
            state.authTokenRefreshPromise = null;
        }
    })();

    return state.authTokenRefreshPromise;
}

async function ensureValidAuthToken() {
    if (!state.authToken) {
        return refreshAuthToken(false);
    }
    if (!isAuthTokenExpiringSoon()) {
        return true;
    }
    return refreshAuthToken(true);
}

async function fetchApi(path, options = {}) {
    await ensureValidAuthToken();
    const requestOptions = { ...options, credentials: 'include' };
    const headers = new Headers(options.headers || {});
    if (!headers.has('X-PuddleJumper-Request')) {
        headers.set('X-PuddleJumper-Request', 'true');
    }
    const authHeader = normalizeAuthorizationHeader(state.authToken);
    if (authHeader && !headers.has('Authorization')) {
        headers.set('Authorization', authHeader);
    }
    requestOptions.headers = headers;

    const requestUrl = resolveApiUrl(path);
    const isTokenEndpoint = requestUrl.endsWith("/api/pj/identity-token");
    let attemptedRetry = false;
    let response = await fetch(requestUrl, requestOptions);
    if (response.status === 401 && !attemptedRetry && !isTokenEndpoint) {
        attemptedRetry = true;
        const refreshed = await refreshAuthToken(true);
        if (refreshed) {
            const retryHeaders = new Headers(options.headers || {});
            if (!retryHeaders.has('X-PuddleJumper-Request')) {
                retryHeaders.set('X-PuddleJumper-Request', 'true');
            }
            const retryAuthHeader = normalizeAuthorizationHeader(state.authToken);
            if (retryAuthHeader && !retryHeaders.has("Authorization")) {
                retryHeaders.set("Authorization", retryAuthHeader);
            }
            requestOptions.headers = retryHeaders;
            response = await fetch(requestUrl, requestOptions);
        } else {
            throw new Error("Authentication required");
        }
    }
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    const payload = isJson ? await response.json() : await response.text();
    if (!response.ok) {
        const message = payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : `Request failed (${response.status})`;
        throw new Error(message);
    }
    return payload;
}

async function loadCapabilitiesFromApi(force = false) {
    if (!state.manifest) {
        throw new Error('Capability manifest unavailable');
    }
    if (state.manifest.capabilities[CAPABILITY_KEYS.POPUP_LAUNCH] !== true) {
        throw new Error('Popout unavailable');
    }
    if (state.manifest.capabilities[CAPABILITY_KEYS.CAPABILITIES_READ] !== true) {
        throw new Error('Capabilities unavailable');
    }

    if (!force && state.capabilities) {
        return state.capabilities;
    }
    if (state.capabilitiesPromise) {
        return state.capabilitiesPromise;
    }

    state.capabilitiesPromise = (async () => {
        try {
            const capabilities = await fetchApi('/api/config/capabilities');
            if (!capabilities || typeof capabilities !== 'object') {
                throw new Error('Capabilities unavailable');
            }

            const automations = Array.isArray(capabilities.automations) ? capabilities.automations : [];
            const quickActions = Array.isArray(capabilities.quickActions) ? capabilities.quickActions : [];
            if (automations.length === 0 && quickActions.length === 0) {
                throw new Error('Capabilities unavailable');
            }

            state.capabilities = { automations, quickActions };
            return state.capabilities;
        } catch (error) {
            state.capabilities = null;
            throw error;
        } finally {
            state.capabilitiesPromise = null;
        }
    })();

    return state.capabilitiesPromise;
}

function parseCapabilityManifest(payload) {
    if (!payload || typeof payload !== 'object' || !payload.capabilities || typeof payload.capabilities !== 'object') {
        throw new Error('Capability manifest unavailable');
    }

    const capabilities = {};
    Object.values(CAPABILITY_KEYS).forEach((key) => {
        capabilities[key] = payload.capabilities[key] === true;
    });

    return {
        tenantId: typeof payload.tenantId === 'string' ? payload.tenantId : null,
        userId: typeof payload.userId === 'string' ? payload.userId : '',
        capabilities
    };
}

async function loadCapabilityManifestFromApi() {
    const payload = await fetchApi('/api/capabilities/manifest');
    state.manifest = parseCapabilityManifest(payload);
    return state.manifest;
}

function isTrustedOrigin(origin) {
    return isTrustedOriginFromList(origin, state.trustedOrigins);
}

function setIdentityError(message) {
    state.identityLoaded = false;
    state.manifest = null;
    state.capabilities = null;
    state.connectorStatuses = {};
    clearAuthToken();
    operatorName.textContent = message;
    tenantSelect.disabled = true;
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Tenant scope unavailable';
    tenantSelect.replaceChildren(option);
    state.connectionsByTenant = {};
    renderConnectorStatusPanel();
}

function hydrateIdentity(identity) {
    const merged = applyIdentityContext(
        {
            name: '',
            role: '',
            tenants: [],
            trustedParentOrigins: []
        },
        identity
    );

    if (!merged.name || !merged.role) {
        setIdentityError('Identity unavailable');
        return;
    }

    if (!Array.isArray(merged.tenants) || merged.tenants.length === 0) {
        setIdentityError('No tenant scope');
        return;
    }

    state.identityLoaded = true;
    state.manifest = null;
    state.capabilities = null;
    const relayToken = extractRelayToken(identity);
    if (relayToken) {
        setAuthToken(relayToken, resolveTokenExpiryMs(identity, relayToken));
    }
    operatorName.textContent = `${merged.name} · ${merged.role}`;
    const mergedOrigins = new Set(state.trustedOrigins);
    mergedOrigins.add(window.location.origin);
    const trustedParentOrigins = Array.isArray(merged.trustedParentOrigins) ? merged.trustedParentOrigins : [];
    trustedParentOrigins.forEach((origin) => {
        const normalized = normalizeOrigin(origin);
        if (normalized) {
            mergedOrigins.add(normalized);
        }
    });
    state.trustedOrigins = Array.from(mergedOrigins);
    state.tenants = merged.tenants;

    state.connectionsByTenant = {};
    tenantSelect.disabled = false;
    tenantSelect.replaceChildren();
    state.tenants.forEach((tenant, index) => {
        const id = String(tenant.id || `tenant-${index}`);
        const name = String(tenant.name || id);
        state.connectionsByTenant[id] = Array.isArray(tenant.connections) ? tenant.connections.map(String) : [];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        tenantSelect.appendChild(option);
    });
    renderConnectorStatusPanel();
}

async function loadIdentityFromApi() {
    try {
        return await fetchApi('/api/identity');
    } catch (error) {
        const message = String(error && error.message ? error.message : '');
        if (/unauthorized/i.test(message)) {
            throw new Error('Authentication required');
        }
        throw error;
    }
}

function safeText(value, fallback = '', maxLength = 280) {
    const normalized = String(value ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return normalized || fallback;
}

function statusClass(status) {
    const token = safeText(status, 'active', 32).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    return token || 'active';
}

function renderItem(item) {
    if (!item || typeof item !== 'object') {
        return document.createDocumentFragment();
    }

    if (item.type === 'automation' || !item.type) {
        const root = document.createElement('div');
        root.className = 'automation-result';
        root.dataset.modal = safeText(item.id, '', 64);

        const header = document.createElement('div');
        header.className = 'result-header';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'result-title-wrap';

        const icon = document.createElement('div');
        icon.className = 'result-icon';
        icon.textContent = safeText(item.icon, '•', 6);

        const title = document.createElement('div');
        title.className = 'result-title';
        title.textContent = safeText(item.title, 'Untitled automation', 120);

        titleWrap.append(icon, title);

        const status = document.createElement('div');
        const normalizedStatus = statusClass(item.status);
        status.className = `result-status ${normalizedStatus}`;
        status.textContent = safeText(item.status, 'active', 32);

        header.append(titleWrap, status);

        const desc = document.createElement('div');
        desc.className = 'result-desc';
        desc.textContent = safeText(item.desc, '', 240);

        const tags = document.createElement('div');
        tags.className = 'result-tags';
        const tagValues = Array.isArray(item.tags) ? item.tags : [];
        tagValues.forEach((tagValue) => {
            const tag = safeText(tagValue, '', 80);
            if (!tag) {
                return;
            }
            const tagEl = document.createElement('span');
            tagEl.className = `result-tag${tag.includes('M.G.L.') ? ' statutory' : ''}`;
            tagEl.textContent = tag;
            tags.appendChild(tagEl);
        });

        root.append(header, desc, tags);
        return root;
    }

    const root = document.createElement('div');
    root.className = 'action-result';
    root.dataset.modal = safeText(item.modal, '', 64);

    const header = document.createElement('div');
    header.className = 'result-header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'result-title-wrap';

    const icon = document.createElement('div');
    icon.className = 'result-icon';
    icon.textContent = safeText(item.icon, '•', 6);

    const title = document.createElement('div');
    title.className = 'result-title';
    title.textContent = safeText(item.title, 'Untitled action', 120);

    titleWrap.append(icon, title);
    header.appendChild(titleWrap);

    const desc = document.createElement('div');
    desc.className = 'result-desc';
    desc.textContent = safeText(item.desc, '', 240);

    const hint = document.createElement('div');
    hint.className = 'action-hint';
    hint.textContent = safeText(item.hint, '', 240);

    root.append(header, desc, hint);
    return root;
}

function updateResults() {
    if (!state.identityLoaded) {
        resultsContainer.replaceChildren();
        emptyState.hidden = true;
        resultCount.textContent = 'Awaiting authenticated identity';
        return;
    }
    if (!state.manifest) {
        resultsContainer.replaceChildren();
        emptyState.hidden = true;
        resultCount.textContent = 'Capability manifest unavailable';
        return;
    }
    if (state.manifest.capabilities[CAPABILITY_KEYS.POPUP_LAUNCH] !== true) {
        resultsContainer.replaceChildren();
        emptyState.hidden = true;
        resultCount.textContent = 'Popout unavailable for this account';
        return;
    }
    if (state.manifest.capabilities[CAPABILITY_KEYS.CAPABILITIES_READ] !== true) {
        resultsContainer.replaceChildren();
        emptyState.hidden = true;
        resultCount.textContent = 'Capabilities unavailable for this account';
        return;
    }
    if (!state.capabilities) {
        resultsContainer.replaceChildren();
        emptyState.hidden = true;
        resultCount.textContent = 'Capabilities unavailable';
        return;
    }

    const term = omnisearch.value.toLowerCase().trim();
    let shown = [];
    const automations = state.capabilities.automations;
    const quickActions = state.capabilities.quickActions;

    const matchingAutos = automations.filter((a) =>
        term === '' ||
        a.title.toLowerCase().includes(term) ||
        a.desc.toLowerCase().includes(term) ||
        a.tags.some((t) => t.toLowerCase().includes(term))
    );
    shown = shown.concat(matchingAutos.map((a) => ({ ...a, type: 'automation' })));

    if (term !== '') {
        quickActions.forEach((action) => {
            if (action.trigger.some((t) => term.includes(t) || t.includes(term))) {
                shown.push({ type: 'action', ...action });
            }
        });
    }

    if (term === '') {
        shown = [
            automations[0],
            automations[3],
            automations[4],
            { type: 'action', ...quickActions[0] },
            { type: 'action', ...quickActions[2] },
            { type: 'action', ...quickActions[1] }
        ].filter(Boolean);
    }

    resultsContainer.replaceChildren();
    shown.forEach((item) => {
        const node = renderItem(item);
        resultsContainer.appendChild(node);
    });
    emptyState.hidden = shown.length > 0;
    resultCount.textContent = term === '' ? 'Key capabilities' : `Found ${shown.length} result${shown.length !== 1 ? 's' : ''}`;
}

function updateConnections() {
    if (!state.identityLoaded) {
        connectionsList.replaceChildren();
        return;
    }

    const tenant = tenantSelect.value;
    connectionsList.replaceChildren();
    const conns = state.connectionsByTenant[tenant] || [];
    conns.forEach((name) => {
        const div = document.createElement('div');
        div.className = 'connection';
        const dot = document.createElement('div');
        dot.className = 'connection-dot';
        const label = document.createElement('span');
        label.textContent = String(name);
        div.appendChild(dot);
        div.appendChild(label);
        connectionsList.appendChild(div);
    });
}

function providerLabel(provider) {
    if (provider === 'microsoft') return 'Microsoft 365';
    if (provider === 'google') return 'Google Workspace';
    if (provider === 'github') return 'GitHub';
    return String(provider || 'Connector');
}

function getConnectorStatuses() {
    if (!state.connectorStatuses || typeof state.connectorStatuses !== 'object') {
        return {};
    }
    return state.connectorStatuses;
}

function clearConnectorPoll(provider) {
    const existing = connectorAuthPollers[provider];
    if (existing) {
        clearInterval(existing.timerId);
        delete connectorAuthPollers[provider];
    }
}

function renderConnectorStatusPanel() {
    if (!connectorStatusPanel) {
        return;
    }
    connectorStatusPanel.replaceChildren();

    if (!state.identityLoaded) {
        const empty = document.createElement('div');
        empty.className = 'connector-status-empty';
        empty.textContent = 'Awaiting authenticated identity.';
        connectorStatusPanel.appendChild(empty);
        return;
    }

    const statuses = getConnectorStatuses();
    const hasStatuses = Object.keys(statuses).length > 0;
    if (!hasStatuses) {
        const empty = document.createElement('div');
        empty.className = 'connector-status-empty';
        empty.textContent = 'Connector status unavailable.';
        connectorStatusPanel.appendChild(empty);
        return;
    }

    CONNECTOR_PROVIDER_ORDER.forEach((provider) => {
        const status = statuses[provider] && typeof statuses[provider] === 'object'
            ? statuses[provider]
            : { connected: false };
        const connected = status.connected === true;
        const account = typeof status.account === 'string' ? status.account.trim() : '';
        const expiresAt = typeof status.expiresAt === 'string' ? status.expiresAt.trim() : '';

        const row = document.createElement('div');
        row.className = 'connector-status-row';

        const left = document.createElement('div');
        left.className = 'connector-status-left';
        const name = document.createElement('div');
        name.className = 'connector-status-name';
        name.textContent = providerLabel(provider);
        const detail = document.createElement('div');
        detail.className = 'connector-status-detail';
        if (connected) {
            detail.textContent = account
                ? `Connected as ${account}${expiresAt ? ` - expires ${expiresAt}` : ''}`
                : `Connected${expiresAt ? ` - expires ${expiresAt}` : ''}`;
        } else {
            detail.textContent = 'Disconnected';
        }
        left.append(name, detail);

        const actionButton = document.createElement('button');
        actionButton.type = 'button';
        actionButton.className = `connector-status-btn${connected ? '' : ' primary'}`;
        actionButton.textContent = connected ? 'Disconnect' : 'Connect';
        actionButton.addEventListener('click', () => {
            if (connected) {
                void disconnectProvider(provider);
            } else {
                void connectProvider(provider);
            }
        });

        row.append(left, actionButton);
        connectorStatusPanel.appendChild(row);
    });
}

async function refreshConnectorStatuses() {
    if (!state.identityLoaded) {
        state.connectorStatuses = {};
        renderConnectorStatusPanel();
        return;
    }
    try {
        const payload = await fetchApi('/api/connectors');
        state.connectorStatuses =
            payload && typeof payload === 'object' && payload.connectors && typeof payload.connectors === 'object'
                ? payload.connectors
                : {};
    } catch {
        state.connectorStatuses = {};
    }
    renderConnectorStatusPanel();
}

async function postApi(path, body = {}) {
    return fetchApi(path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}

async function connectProvider(provider) {
    clearConnectorPoll(provider);
    try {
        const payload = await postApi(`/api/connectors/${encodeURIComponent(provider)}/auth/start`, {});
        const authUrl = payload && typeof payload === 'object' && typeof payload.authUrl === 'string'
            ? payload.authUrl
            : '';
        if (!authUrl) {
            throw new Error('Authorization URL missing');
        }
        const popup = window.open(authUrl, `pj-connector-auth-${provider}`, 'width=560,height=720');
        if (!popup) {
            window.location.assign(authUrl);
            return;
        }
        let attempts = 0;
        const timerId = setInterval(async () => {
            attempts += 1;
            try {
                await refreshConnectorStatuses();
                const status = getConnectorStatuses()[provider];
                if (status && status.connected === true) {
                    clearConnectorPoll(provider);
                    if (!popup.closed) {
                        popup.close();
                    }
                }
            } catch {
                // continue polling until timeout
            }
            if (attempts >= 90 || popup.closed) {
                clearConnectorPoll(provider);
            }
        }, 2000);
        connectorAuthPollers[provider] = { timerId };
    } catch {
        alert('Failed to start connector auth.');
    }
}

async function disconnectProvider(provider) {
    const confirmed = window.confirm(`Disconnect ${providerLabel(provider)}?`);
    if (!confirmed) {
        return;
    }
    clearConnectorPoll(provider);
    try {
        await postApi(`/api/connectors/${encodeURIComponent(provider)}/disconnect`, {});
        await refreshConnectorStatuses();
    } catch {
        alert('Failed to disconnect connector.');
    }
}

document.addEventListener('click', (e) => {
    const result = e.target.closest('.automation-result') || e.target.closest('.action-result');
    if (result) {
        const modalId = result.dataset.modal;
        if (modalId) {
            document.getElementById(modalId)?.classList.add('active');
            document.getElementById('overlay').classList.add('active');
        }
    }
});

document.getElementById('overlay').addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach((m) => m.classList.remove('active'));
    document.getElementById('overlay').classList.remove('active');
});

document.querySelectorAll('.close-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.modal').forEach((m) => m.classList.remove('active'));
        document.getElementById('overlay').classList.remove('active');
    });
});

omnisearch.addEventListener('input', updateResults);
tenantSelect.addEventListener('change', () => {
    updateConnections();
    updateResults();
});

window.addEventListener('message', (event) => {
    if (!isTrustedOrigin(event.origin)) {
        return;
    }
    setApiBaseOrigin(event.origin);
    if (event.data && event.data.type === 'PJ_AUTH_TOKEN' && event.data.payload) {
        const relayToken = extractRelayToken(event.data.payload);
        if (relayToken) {
            setAuthToken(relayToken, resolveTokenExpiryMs(event.data.payload, relayToken));
            void (async () => {
                try {
                    await loadCapabilityManifestFromApi();
                    await loadCapabilitiesFromApi();
                    await refreshConnectorStatuses();
                } catch (error) {
                    console.warn('Token relay capability refresh failed', error);
                }
                updateResults();
            })();
        }
        return;
    }
    if (event.data && event.data.type === 'PJ_IDENTITY_CONTEXT' && event.data.payload) {
        void (async () => {
            hydrateIdentity(event.data.payload);
            updateConnections();
            if (!state.manifest) {
                try {
                    await loadCapabilityManifestFromApi();
                } catch (error) {
                    console.warn('Capability manifest re-fetch failed', error);
                }
            }
            if (!state.capabilities) {
                try {
                    await loadCapabilitiesFromApi();
                } catch (error) {
                    console.warn('Capability re-fetch failed', error);
                }
            }
            await refreshConnectorStatuses();
            updateResults();
        })();
    }
});

function requestParentIdentityContext() {
    if (window.parent === window) {
        return;
    }
    resolveParentMessageOrigins().forEach((origin) => {
        if (!origin) {
            return;
        }
        try {
            window.parent.postMessage(
                {
                    type: "PJ_CONTEXT_REQUEST",
                    payload: { includeToken: true, includeIdentity: true }
                },
                origin
            );
        } catch {
            // Best-effort handshake only.
        }
    });
}

alignApiBaseWithParentContext();
requestParentIdentityContext();
renderConnectorStatusPanel();
loadIdentityFromApi()
    .then(async (identity) => {
        hydrateIdentity(identity);
        updateConnections();
        try {
            await loadCapabilityManifestFromApi();
        } catch {
            // Keep authenticated identity visible and allow later recovery.
        }
        try {
            await loadCapabilitiesFromApi();
        } catch {
            // Keep authenticated identity visible and allow later recovery.
        }
        await refreshConnectorStatuses();
        updateResults();
    })
    .catch((error) => {
        setIdentityError(error.message || 'Identity unavailable');
        updateConnections();
        renderConnectorStatusPanel();
        updateResults();
    });
    
