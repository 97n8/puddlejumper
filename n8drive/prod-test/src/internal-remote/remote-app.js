const STORAGE_KEY = "puddle_jumper_tiles_v2";

const INTENT_OPTIONS = {
  launch: ["open_repository", "open_365_location", "run_automation", "health_check"],
  governed: ["create_environment", "deploy_policy", "seal_record", "archive", "notify", "file"]
};

const CAPABILITY_KEYS = {
  CORE_PROMPT_READ: "corePrompt.read",
  CORE_PROMPT_EDIT: "corePrompt.edit",
  EVALUATE_EXECUTE: "evaluate.execute",
  MISSION_TILES_READ: "missionControl.tiles.read",
  MISSION_TILES_CUSTOMIZE: "missionControl.tiles.customize"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadStoredTiles() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveTiles(tiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
}

async function fetchApi(path, options = {}) {
  const fetchOptions = { ...options, credentials: "include" };
  const headers = new Headers(options.headers || {});
  if (!headers.has("X-PuddleJumper-Request")) {
    headers.set("X-PuddleJumper-Request", "true");
  }
  if (fetchOptions.body !== undefined && fetchOptions.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  fetchOptions.headers = headers;

  const response = await fetch(path, fetchOptions);
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : typeof payload === "string" && payload
          ? payload
          : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function parseCapabilityManifest(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Capability manifest unavailable");
  }
  if (!payload.capabilities || typeof payload.capabilities !== "object") {
    throw new Error("Capability manifest unavailable");
  }

  const required = Object.values(CAPABILITY_KEYS);
  const manifestCapabilities = {};
  required.forEach((key) => {
    manifestCapabilities[key] = payload.capabilities[key] === true;
  });

  return {
    tenantId: payload.tenantId ?? null,
    userId: typeof payload.userId === "string" ? payload.userId : "",
    capabilities: manifestCapabilities
  };
}

async function loadCapabilityManifest() {
  const payload = await fetchApi("/api/capabilities/manifest");
  return parseCapabilityManifest(payload);
}

function hasCapability(state, capabilityKey) {
  return state.manifest?.capabilities?.[capabilityKey] === true;
}

function normalizedText(value, fallback = "", maxLength = 140) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function normalizeMode(value, fallback) {
  return value === "governed" || value === "launch" ? value : fallback;
}

function mergeTilesWithOverrides(liveTiles, overrides) {
  const byId = new Map();
  if (Array.isArray(overrides)) {
    overrides.forEach((entry) => {
      if (!entry || typeof entry !== "object") {
        return;
      }
      const id = normalizedText(entry.id, "", 80);
      if (!id) {
        return;
      }
      byId.set(id, entry);
    });
  }

  return liveTiles.map((tile) => {
    const override = byId.get(tile.id);
    if (!override) {
      return clone(tile);
    }
    return {
      ...tile,
      label: normalizedText(override.label, tile.label, 80),
      icon: normalizedText(override.icon, tile.icon, 4),
      mode: normalizeMode(override.mode, tile.mode),
      intent: normalizedText(override.intent, tile.intent, 60),
      target: normalizedText(override.target, tile.target, 500),
      tone: normalizedText(override.tone, tile.tone, 20),
      description: normalizedText(override.description, tile.description, 240),
      emergency: override.emergency === true ? true : tile.emergency === true
    };
  });
}

function makeUi() {
  return {
    deckEl: document.getElementById("tile-deck"),
    envBadgeEl: document.getElementById("env-badge"),
    envLabelEl: document.getElementById("env-label"),
    phaseEl: document.getElementById("phase-pill"),
    operatorLabelEl: document.getElementById("operator-label"),
    toastEl: document.getElementById("toast"),
    healthButton: document.getElementById("health-check"),
    customizeButton: document.getElementById("customize-tiles"),
    advancedEl: document.getElementById("advanced-panel"),
    lastActionEl: document.getElementById("last-action"),
    lastStatusEl: document.getElementById("last-status"),
    lastHashEl: document.getElementById("last-hash"),
    lastEventEl: document.getElementById("last-event"),
    payloadPreviewEl: document.getElementById("payload-preview"),
    runPreviewButton: document.getElementById("run-preview"),
    auditOutputEl: document.getElementById("audit-output"),
    warningsListEl: document.getElementById("warnings-list"),
    nextStepsListEl: document.getElementById("next-steps-list"),
    planOutputEl: document.getElementById("plan-output"),
    openCorePromptButton: document.getElementById("open-core-prompt"),
    copyCorePromptButton: document.getElementById("copy-core-prompt"),
    promptVersionEl: document.getElementById("prompt-version"),
    promptClassificationEl: document.getElementById("prompt-classification"),
    promptHashEl: document.getElementById("prompt-hash"),
    corePromptSectionEl: document.getElementById("core-prompt-section"),
    corePromptOutputEl: document.getElementById("core-prompt-output"),
    tileFormEl: document.getElementById("tile-form"),
    tileSelectEl: document.getElementById("tile-select"),
    tileLabelEl: document.getElementById("tile-label"),
    tileIconEl: document.getElementById("tile-icon"),
    tileModeEl: document.getElementById("tile-mode"),
    tileIntentEl: document.getElementById("tile-intent"),
    tileTargetEl: document.getElementById("tile-target"),
    tileToneEl: document.getElementById("tile-tone"),
    saveTileButton: document.getElementById("save-tile"),
    resetTilesButton: document.getElementById("reset-tiles")
  };
}

function setCorePromptVisibility(ui, visible) {
  if (!ui.corePromptSectionEl) {
    return;
  }
  ui.corePromptSectionEl.hidden = !visible;
}

function applyCapabilityUiState(ui, state) {
  const canReadCorePrompt = hasCapability(state, CAPABILITY_KEYS.CORE_PROMPT_READ);
  const canCustomizeTiles = hasCapability(state, CAPABILITY_KEYS.MISSION_TILES_CUSTOMIZE);
  const canExecute = hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE);

  setCorePromptVisibility(ui, canReadCorePrompt);

  ui.customizeButton.hidden = !canCustomizeTiles;
  ui.advancedEl.hidden = !canCustomizeTiles;
  if (!canCustomizeTiles) {
    ui.advancedEl.open = false;
  }

  ui.healthButton.disabled = !canExecute;
  ui.runPreviewButton.disabled = !canExecute;
  ui.openCorePromptButton.disabled = !canReadCorePrompt;
  ui.copyCorePromptButton.disabled = !canReadCorePrompt;
}

function setToast(ui, text, severity) {
  ui.toastEl.textContent = text;
  ui.toastEl.className = `toast ${severity}`;
}

function setPhase(ui, text) {
  ui.phaseEl.textContent = `Status: ${text}`;
}

function renderList(element, values, formatter, emptyText = "None.") {
  element.innerHTML = "";
  if (!Array.isArray(values) || values.length === 0) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    element.appendChild(item);
    return;
  }

  values.forEach((value) => {
    const item = document.createElement("li");
    item.textContent = formatter(value);
    element.appendChild(item);
  });
}

function normalizeTargets(raw) {
  return String(raw)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildPayload(basePayload, tile) {
  const payload = clone(basePayload);
  payload.action.mode = tile.mode;
  payload.action.intent = tile.intent;
  payload.action.targets = normalizeTargets(tile.target);
  payload.action.requestId = `tile-${tile.id}-${Date.now()}`;
  payload.action.metadata = payload.action.metadata || {};
  payload.action.metadata.description = tile.description || tile.label;

  if (tile.mode === "launch") {
    payload.action.trigger = {
      type: "manual",
      reference: "mission-control",
      evidence: {
        citation: "Operator initiated launcher action"
      }
    };
    payload.action.metadata.urgency = "normal";
    delete payload.action.metadata.archieve;
  } else {
    payload.action.trigger = {
      type: tile.emergency ? "manual" : "form",
      reference: tile.emergency ? "emergency-launch" : "governed-launch",
      evidence: tile.emergency
        ? {
            statute: "MGL Ch. 30A Section 20 emergency exception",
            publicSafety: true,
            citation: "Emergency public safety response"
          }
        : {
            statute: "MGL Ch. 66 Section 10",
            policyKey: "records_ack_10d",
            citation: "Governed municipal operation"
          }
    };

    payload.action.metadata.archieve = {
      dept: "clerk",
      type: tile.intent === "seal_record" ? "audit" : tile.intent === "deploy_policy" ? "policy" : "notice",
      date: todayDate(),
      seq: Math.floor(Date.now() / 1000) % 1000,
      v: 1
    };
    payload.action.metadata.urgency = tile.emergency ? "emergency" : "normal";
  }

  return payload;
}

async function evaluatePayload(payload) {
  return fetchApi("/api/evaluate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function renderResult(ui, tile, payload, result) {
  ui.payloadPreviewEl.value = JSON.stringify(payload, null, 2);

  ui.lastActionEl.textContent = tile.label;
  ui.lastStatusEl.textContent = result.approved ? "Approved" : "Blocked";
  ui.lastHashEl.textContent = result.auditRecord?.planHash || "-";
  ui.lastEventEl.textContent = result.auditRecord?.eventId || "-";

  ui.auditOutputEl.textContent = JSON.stringify(result.auditRecord || {}, null, 2);
  ui.planOutputEl.textContent = JSON.stringify(result.actionPlan || result.automationPlan || [], null, 2);
  renderList(ui.warningsListEl, result.warnings, (entry) => entry, "None.");
  renderList(
    ui.nextStepsListEl,
    result.nextSteps,
    (entry) => `${entry.type}: ${JSON.stringify(entry.details)}`,
    "No pending actions."
  );

  const feedback = result.uiFeedback || {};
  setPhase(ui, feedback.lcdStatus || (result.approved ? "Ready" : "Blocked"));
  setToast(ui, feedback.toast?.text || (result.approved ? "Action complete" : "Action blocked"), feedback.toast?.severity || (result.approved ? "success" : "error"));
}

function tileRequiresConfirm(tile) {
  return tile.intent === "seal_record" || tile.emergency === true;
}

async function loadCorePrompt(state) {
  if (!hasCapability(state, CAPABILITY_KEYS.CORE_PROMPT_READ)) {
    throw new Error("Core prompt unavailable for this account");
  }
  if (state.corePrompt) {
    return state.corePrompt;
  }

  const prompt = await fetchApi("/api/core-prompt");
  state.corePrompt = prompt;
  return prompt;
}

function renderCorePromptSummary(ui, prompt) {
  ui.promptVersionEl.textContent = `Version: ${prompt.version || "-"}`;
  const mode = prompt.mode === "full" ? "full" : "summary";
  ui.promptClassificationEl.textContent = `Classification: ${prompt.classification || "-"} (${mode})`;
  ui.promptHashEl.textContent = `Prompt Hash: ${prompt.systemPromptVersion || "-"}`;
  ui.copyCorePromptButton.textContent = mode === "full" ? "Copy Prompt" : "Copy Summary";
}

async function openCorePrompt(ui, state) {
  const prompt = await loadCorePrompt(state);
  renderCorePromptSummary(ui, prompt);
  ui.corePromptOutputEl.textContent = prompt.content || "";
  ui.corePromptOutputEl.hidden = false;
}

async function copyCorePrompt(ui, state) {
  const prompt = await loadCorePrompt(state);
  renderCorePromptSummary(ui, prompt);
  const text = prompt.content || "";
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "readonly");
  fallback.style.position = "absolute";
  fallback.style.left = "-9999px";
  document.body.appendChild(fallback);
  fallback.select();
  document.execCommand("copy");
  document.body.removeChild(fallback);
}

async function runTile(ui, state, tile) {
  if (!hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE)) {
    setToast(ui, "You do not have permission to execute actions.", "error");
    return;
  }

  if (tileRequiresConfirm(tile)) {
    const confirmed = window.confirm(`Run ${tile.label}? This action is safety-sensitive.`);
    if (!confirmed) {
      return;
    }
  }

  const payload = buildPayload(state.basePayload, tile);
  setPhase(ui, "Dispatching");
  setToast(ui, `Running ${tile.label}`, "info");

  try {
    const result = await evaluatePayload(payload);
    renderResult(ui, tile, payload, result);
  } catch (error) {
    setPhase(ui, "Request failed");
    setToast(ui, error.message || "Request failed", "error");
  }
}

function createTileButton(ui, state, tile, index) {
  const canExecute = hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE);
  const button = document.createElement("button");
  button.type = "button";
  button.className = `tile tone-${tile.tone || "neutral"}`;
  button.style.setProperty("--i", String(index));
  button.dataset.tileId = tile.id;
  button.disabled = !canExecute;

  const icon = document.createElement("span");
  icon.className = "tile-icon";
  icon.textContent = normalizedText(tile.icon, "◼", 4);

  const textBlock = document.createElement("div");
  const label = document.createElement("div");
  label.className = "tile-label";
  label.textContent = normalizedText(tile.label, "Untitled Tile", 80);
  const subtitle = document.createElement("div");
  subtitle.className = "tile-sub";
  subtitle.textContent = normalizedText(tile.description, "", 240);
  textBlock.appendChild(label);
  textBlock.appendChild(subtitle);

  const mode = document.createElement("span");
  mode.className = "tile-mode";
  mode.textContent = normalizedText(tile.mode, "launch", 20);

  button.appendChild(icon);
  button.appendChild(textBlock);
  button.appendChild(mode);

  button.addEventListener("click", () => {
    if (!canExecute) {
      return;
    }
    runTile(ui, state, tile);
  });
  return button;
}

function renderDeck(ui, state) {
  ui.deckEl.innerHTML = "";
  state.tiles.forEach((tile, index) => {
    ui.deckEl.appendChild(createTileButton(ui, state, tile, index));
  });
}

function syncIntentOptions(ui, mode, selectedIntent) {
  const intents = INTENT_OPTIONS[mode] || INTENT_OPTIONS.launch;
  ui.tileIntentEl.innerHTML = "";
  intents.forEach((intent) => {
    const option = document.createElement("option");
    option.value = intent;
    option.textContent = intent;
    ui.tileIntentEl.appendChild(option);
  });

  if (intents.includes(selectedIntent)) {
    ui.tileIntentEl.value = selectedIntent;
  }
}

function currentTile(state, tileId) {
  return state.tiles.find((tile) => tile.id === tileId) || state.tiles[0];
}

function populateEditor(ui, state, tileId) {
  const tile = currentTile(state, tileId);
  if (!tile) {
    return;
  }

  ui.tileSelectEl.value = tile.id;
  ui.tileLabelEl.value = tile.label;
  ui.tileIconEl.value = tile.icon;
  ui.tileModeEl.value = tile.mode;
  syncIntentOptions(ui, tile.mode, tile.intent);
  ui.tileTargetEl.value = tile.target;
  ui.tileToneEl.value = tile.tone;
}

function renderTileSelect(ui, state) {
  ui.tileSelectEl.innerHTML = "";
  state.tiles.forEach((tile) => {
    const option = document.createElement("option");
    option.value = tile.id;
    option.textContent = tile.label;
    ui.tileSelectEl.appendChild(option);
  });
}

function hydrateMeta(ui, payload) {
  ui.operatorLabelEl.textContent = payload.operator?.name || payload.operator?.id || "Unknown";
  const env = payload.action?.environment || "production";
  ui.envLabelEl.textContent = env === "production" ? "Environment: Production" : `Environment: ${env}`;
  ui.envBadgeEl.classList.toggle("sandbox", env !== "production");
}

async function runHealth(ui, state) {
  const healthTile = {
    id: "health",
    label: "Run Health Check",
    icon: "🩺",
    mode: "launch",
    intent: "health_check",
    target: "health:system",
    tone: "neutral",
    description: "Check system status"
  };
  await runTile(ui, state, healthTile);
}

function wireEditor(ui, state) {
  if (!hasCapability(state, CAPABILITY_KEYS.MISSION_TILES_CUSTOMIZE)) {
    return;
  }

  ui.tileSelectEl.addEventListener("change", (event) => {
    populateEditor(ui, state, event.target.value);
  });

  ui.tileModeEl.addEventListener("change", (event) => {
    syncIntentOptions(ui, event.target.value, ui.tileIntentEl.value);
  });

  ui.tileFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const tile = currentTile(state, ui.tileSelectEl.value);
    if (!tile) {
      return;
    }

    tile.label = normalizedText(ui.tileLabelEl.value, tile.label, 80);
    tile.icon = normalizedText(ui.tileIconEl.value, tile.icon, 4);
    tile.mode = normalizeMode(ui.tileModeEl.value, tile.mode);
    tile.intent = normalizedText(ui.tileIntentEl.value, tile.intent, 60);
    tile.target = normalizedText(ui.tileTargetEl.value, tile.target, 500);
    tile.tone = normalizedText(ui.tileToneEl.value, tile.tone, 20);

    saveTiles(state.tiles);
    renderTileSelect(ui, state);
    populateEditor(ui, state, tile.id);
    renderDeck(ui, state);
    setToast(ui, "Tile updated", "success");
  });

  ui.resetTilesButton.addEventListener("click", () => {
    state.tiles = clone(state.liveTiles);
    localStorage.removeItem(STORAGE_KEY);
    saveTiles(state.tiles);
    renderTileSelect(ui, state);
    populateEditor(ui, state, state.tiles[0].id);
    renderDeck(ui, state);
    setToast(ui, "Deck reset", "info");
  });
}

function wireActions(ui, state) {
  ui.healthButton.addEventListener("click", () => {
    if (!hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE)) {
      setToast(ui, "You do not have permission to execute actions.", "error");
      return;
    }
    runHealth(ui, state);
  });
  ui.customizeButton.addEventListener("click", () => {
    if (!hasCapability(state, CAPABILITY_KEYS.MISSION_TILES_CUSTOMIZE)) {
      setToast(ui, "Tile editing is not available for your account.", "error");
      return;
    }
    ui.advancedEl.open = true;
    ui.tileSelectEl.focus();
  });
  ui.openCorePromptButton.addEventListener("click", async () => {
    if (!hasCapability(state, CAPABILITY_KEYS.CORE_PROMPT_READ)) {
      setToast(ui, "Core prompt unavailable for this account.", "error");
      return;
    }
    try {
      await openCorePrompt(ui, state);
      setToast(ui, "Core prompt opened", "success");
    } catch (error) {
      setToast(ui, error.message || "Unable to load core prompt", "error");
    }
  });
  ui.copyCorePromptButton.addEventListener("click", async () => {
    if (!hasCapability(state, CAPABILITY_KEYS.CORE_PROMPT_READ)) {
      setToast(ui, "Core prompt unavailable for this account.", "error");
      return;
    }
    try {
      await copyCorePrompt(ui, state);
      setToast(ui, "Core prompt copied", "success");
    } catch (error) {
      setToast(ui, error.message || "Unable to copy core prompt", "error");
    }
  });

  ui.runPreviewButton.addEventListener("click", async () => {
    if (!hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE)) {
      setToast(ui, "You do not have permission to execute actions.", "error");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(ui.payloadPreviewEl.value);
    } catch {
      setToast(ui, "Payload preview is not valid JSON", "error");
      return;
    }

    setPhase(ui, "Dispatching");
    setToast(ui, "Running preview payload", "info");

    try {
      const result = await evaluatePayload(payload);
      renderResult(ui, { label: "Preview Payload" }, payload, result);
    } catch (error) {
      setPhase(ui, "Request failed");
      setToast(ui, error.message || "Request failed", "error");
    }
  });
}

async function loadBasePayload() {
  const runtime = await fetchApi("/api/runtime/context");
  if (!runtime || typeof runtime !== "object") {
    throw new Error("Runtime context unavailable");
  }

  const targets = Array.isArray(runtime.actionDefaults?.targets) ? runtime.actionDefaults.targets.map((entry) => String(entry)) : [];
  return {
    workspace: runtime.workspace,
    municipality: runtime.municipality,
    operator: runtime.operator,
    action: {
      mode: runtime.actionDefaults?.mode || "launch",
      trigger: {
        type: "manual",
        reference: "mission-control",
        evidence: {
          citation: "Operator initiated launcher action"
        }
      },
      intent: runtime.actionDefaults?.intent || "health_check",
      targets: targets.length > 0 ? targets : ["health:system"],
      environment: runtime.actionDefaults?.environment || "production",
      metadata: {
        description: runtime.actionDefaults?.description || "Runtime action"
      },
      requestId: `runtime-${Date.now()}`
    },
    timestamp: runtime.timestamp || new Date().toISOString()
  };
}

async function loadLiveTiles() {
  const tiles = await fetchApi("/api/config/tiles");
  if (!Array.isArray(tiles) || tiles.length === 0) {
    throw new Error("Live tiles unavailable");
  }
  return tiles;
}

export async function bootRemoteApp() {
  const ui = makeUi();
  setPhase(ui, "Ready");
  setCorePromptVisibility(ui, false);

  try {
    const manifest = await loadCapabilityManifest();
    if (!manifest.userId || !hasCapability({ manifest }, CAPABILITY_KEYS.MISSION_TILES_READ)) {
      throw new Error("Mission Control unavailable for this account");
    }

    const [basePayload, liveTiles] = await Promise.all([loadBasePayload(), loadLiveTiles()]);
    const storedTiles = loadStoredTiles();
    const state = {
      manifest,
      basePayload,
      liveTiles: clone(liveTiles),
      tiles: mergeTilesWithOverrides(liveTiles, storedTiles),
      corePrompt: null
    };

    applyCapabilityUiState(ui, state);
    hydrateMeta(ui, basePayload);
    renderDeck(ui, state);

    renderTileSelect(ui, state);
    populateEditor(ui, state, state.tiles[0].id);
    wireEditor(ui, state);
    wireActions(ui, state);

    ui.payloadPreviewEl.value = JSON.stringify(buildPayload(basePayload, state.tiles[0]), null, 2);
    if (hasCapability(state, CAPABILITY_KEYS.CORE_PROMPT_READ)) {
      loadCorePrompt(state)
        .then((prompt) => {
          renderCorePromptSummary(ui, prompt);
          setCorePromptVisibility(ui, true);
        })
        .catch(() => {
          setCorePromptVisibility(ui, false);
        });
    }
    setPhase(ui, "Ready");
    setToast(ui, hasCapability(state, CAPABILITY_KEYS.EVALUATE_EXECUTE) ? "System is online." : "Connected in read-only mode.", "success");
  } catch (error) {
    setPhase(ui, "Init failed");
    setToast(ui, error.message || "Failed to initialize", "error");
  }
}
