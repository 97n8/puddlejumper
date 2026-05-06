// main.js - PuddleJumper mobile home screen
(function () {
  "use strict";

  var TOKEN_KEY = "pj_token";
  var SETTINGS_KEY = "pj_mobile_settings_v1";
  var CASES_KEY = "pj_mobile_cases_v1";
  var TASKS_KEY = "pj_mobile_tasks_v1";
  var CAPTURES_KEY = "pj_mobile_captures_v1";
  var DISMISSED_REMOTE_TASKS_KEY = "pj_mobile_remote_task_dismissed_v1";

  var DEFAULT_SETTINGS = {
    puddleJumperUrl: window.location.origin,
    logicOsUrl: "https://os.publiclogic.org",
    publicLogicUrl: "https://publiclogic.org",
    operationsUrl: window.location.origin + "/pj/admin",
    guideUrl: window.location.origin + "/pj/guide",
    aiModel: "claude-sonnet-4-6",
    aiEnabled: true
  };

  var DEFAULT_CASES = [
    {
      id: "case-zoning-board",
      name: "Zoning Board Packet",
      kicker: "Approvals, routing, and packet readiness",
      color: "#10b981",
      pinned: true,
      lastOpened: Date.now() - 60 * 60 * 1000
    },
    {
      id: "case-prr-triage",
      name: "PRR Triage",
      kicker: "Records request intake and due dates",
      color: "#8b5cf6",
      pinned: false,
      lastOpened: Date.now() - 4 * 60 * 60 * 1000
    },
    {
      id: "case-runtime-health",
      name: "Runtime Health",
      kicker: "Deploy status, incidents, and subsystem checks",
      color: "#f59e0b",
      pinned: true,
      lastOpened: Date.now() - 12 * 60 * 60 * 1000
    }
  ];

  var DEFAULT_TASKS = [
    {
      id: "task-approval-review",
      text: "Review the oldest pending approval in PJ Operations",
      caseId: "case-zoning-board",
      done: false,
      completedAt: null
    },
    {
      id: "task-health-check",
      text: "Check deep health and confirm the Fly volume is writable",
      caseId: "case-runtime-health",
      done: false,
      completedAt: null
    },
    {
      id: "task-prr-followup",
      text: "Follow up on the current records request queue",
      caseId: "case-prr-triage",
      done: true,
      completedAt: Date.now() - 2 * 60 * 60 * 1000
    }
  ];

  var state = {
    currentTab: "today",
    settings: DEFAULT_SETTINGS,
    cases: DEFAULT_CASES.slice(),
    tasks: DEFAULT_TASKS.slice(),
    captures: [],
    dismissedRemoteTasks: [],
    authReady: false,
    isAuthed: false,
    online: false,
    userName: "",
    usingRemoteTasks: false,
    usingRemoteCases: false,
    remoteTasks: []
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getAuthHeaders(extra) {
    var token = getStoredToken();
    var headers = extra ? Object.assign({}, extra) : {};
    if (token) {
      headers.Authorization = "Bearer " + token;
    }
    return headers;
  }

  function loadState() {
    state.settings = Object.assign({}, DEFAULT_SETTINGS, readJson(SETTINGS_KEY, {}));
    state.cases = readJson(CASES_KEY, DEFAULT_CASES.slice());
    state.tasks = readJson(TASKS_KEY, DEFAULT_TASKS.slice());
    state.captures = readJson(CAPTURES_KEY, []);
    state.dismissedRemoteTasks = readJson(DISMISSED_REMOTE_TASKS_KEY, []);
  }

  function persistLocalState() {
    writeJson(SETTINGS_KEY, state.settings);
    if (!state.usingRemoteCases) {
      writeJson(CASES_KEY, state.cases);
    }
    if (!state.usingRemoteTasks) {
      writeJson(TASKS_KEY, state.tasks);
    }
    writeJson(CAPTURES_KEY, state.captures);
    writeJson(DISMISSED_REMOTE_TASKS_KEY, state.dismissedRemoteTasks);
  }

  function absoluteUrl(url, fallbackPath) {
    try {
      return new URL(url || fallbackPath, window.location.origin).toString();
    } catch (_error) {
      return new URL(fallbackPath, window.location.origin).toString();
    }
  }

  function relativePath(url, fallbackPath) {
    try {
      var parsed = new URL(url || fallbackPath, window.location.origin);
      return parsed.href;
    } catch (_error) {
      return fallbackPath;
    }
  }

  function showTab(tabName) {
    state.currentTab = tabName;

    Array.prototype.forEach.call(document.querySelectorAll(".tab-panel"), function (panel) {
      panel.hidden = panel.id !== "tab-" + tabName;
    });

    Array.prototype.forEach.call(document.querySelectorAll(".bottom-nav__item"), function (button) {
      var isActive = button.dataset.tab === tabName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function setOnlineState(status, label) {
    var pill = byId("onlinePill");
    var text = byId("onlineLabel");
    if (pill) {
      pill.dataset.state = status;
    }
    if (text) {
      text.textContent = label;
    }
  }

  function setAuthState(status, label) {
    var chip = byId("authState");
    if (chip) {
      chip.dataset.state = status;
      chip.textContent = label;
    }
  }

  function updateSummary() {
    var headline = byId("summaryHeadline");
    var intro = byId("todayIntro");
    var taskCount = byId("taskCount");
    var caseCount = byId("caseCount");
    var captureCount = byId("captureCount");

    var activeTasks = state.usingRemoteTasks
      ? state.remoteTasks.length
      : state.tasks.filter(function (task) { return !task.done; }).length;

    if (taskCount) taskCount.textContent = String(activeTasks);
    if (caseCount) caseCount.textContent = String(state.cases.length);
    if (captureCount) captureCount.textContent = String(state.captures.length);

    if (headline) {
      if (state.isAuthed) {
        headline.textContent = state.online
          ? "Signed in and ready to move across PublicLogic surfaces."
          : "Signed in, but the PJ runtime needs attention.";
      } else {
        headline.textContent = state.online
          ? "PublicLogic mobile entrance with PJ runtime available."
          : "PublicLogic mobile entrance with local-only fallbacks.";
      }
    }

    if (intro) {
      if (state.usingRemoteTasks) {
        intro.textContent = "Start with Dashboard or Intake, then move into the rest of PublicLogic from the launch grid below.";
      } else if (state.isAuthed) {
        intro.textContent = "Dashboard and Intake stay front-and-center here, even when the work queue falls back locally.";
      } else {
        intro.textContent = "Use this as your mobile entrance to Dashboard, Intake, LogicOS, PuddleJumper, and local capture even before signing in.";
      }
    }
  }

  function renderTasks() {
    var list = byId("taskList");
    var empty = byId("taskEmpty");
    if (!list || !empty) return;

    var items = state.usingRemoteTasks
      ? state.remoteTasks
      : state.tasks.slice().sort(function (a, b) {
          if (a.done !== b.done) return a.done ? 1 : -1;
          return (b.completedAt || 0) - (a.completedAt || 0);
        });

    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = items.map(function (item) {
      if (state.usingRemoteTasks) {
        return [
          '<article class="list-card list-card--task">',
          '  <div class="list-card__top">',
          '    <span class="priority priority--' + escapeHtml(item.priority || "medium") + '">' + escapeHtml(item.priority || "medium") + '</span>',
          '    <span class="hint-text">' + escapeHtml(item.domain || "workflow") + "</span>",
          "  </div>",
          '  <p class="list-card__title">' + escapeHtml(item.title) + "</p>",
          '  <p class="list-card__copy">' + escapeHtml(item.detail || "") + "</p>",
          '  <div class="list-card__actions">',
          '    <button class="text-button" type="button" data-action="dismiss-remote-task" data-task-id="' + escapeHtml(item.id) + '">Done</button>',
          '    <a class="text-button" href="' + escapeHtml(relativePath(item.actionUrl || state.settings.operationsUrl, "/pj/admin")) + '">Open</a>',
          "  </div>",
          "</article>"
        ].join("");
      }

      var taskCase = findCase(item.caseId);
      return [
        '<article class="list-card list-card--task">',
        '  <label class="checkbox-row">',
        '    <input type="checkbox" data-action="toggle-task" data-task-id="' + escapeHtml(item.id) + '"' + (item.done ? " checked" : "") + ">",
        '    <span class="checkbox-copy">',
        '      <span class="list-card__title' + (item.done ? " is-done" : "") + '">' + escapeHtml(item.text) + "</span>",
        taskCase ? '      <button class="case-pill" type="button" data-action="open-case" data-case-id="' + escapeHtml(taskCase.id) + '">' + escapeHtml(taskCase.name) + "</button>" : "",
        "    </span>",
        "  </label>",
        "</article>"
      ].join("");
    }).join("");
  }

  function renderCases() {
    var list = byId("caseList");
    var empty = byId("caseEmpty");
    if (!list || !empty) return;

    var items = state.cases.slice().sort(function (a, b) {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.lastOpened || 0) - (a.lastOpened || 0);
    });

    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = items.map(function (item) {
      return [
        '<article class="list-card list-card--case">',
        '  <button class="case-button" type="button" data-action="open-case" data-case-id="' + escapeHtml(item.id) + '">',
        '    <span class="case-accent" style="--case-accent:' + escapeHtml(item.color || "#10b981") + '"></span>',
        '    <span class="case-copy">',
        '      <span class="list-card__title">' + escapeHtml(item.name) + "</span>",
        '      <span class="list-card__copy">' + escapeHtml(item.kicker || item.description || "Open in PJ Operations") + "</span>",
        "    </span>",
        item.pinned ? '    <span class="pin-mark" aria-label="Pinned">*</span>' : "",
        "  </button>",
        "</article>"
      ].join("");
    }).join("");

    var select = byId("captureCase");
    if (select) {
      select.innerHTML = ['<option value="">0_INBOX (no case)</option>'].concat(items.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + "</option>";
      })).join("");
    }
  }

  function renderCaptures() {
    var list = byId("captureList");
    var empty = byId("captureEmpty");
    if (!list || !empty) return;

    if (!state.captures.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }

    empty.hidden = true;

    list.innerHTML = state.captures.map(function (capture) {
      var targetCase = findCase(capture.caseId);
      return [
        '<article class="list-card list-card--capture">',
        '  <div class="list-card__top">',
        '    <span class="capture-state" data-state="' + escapeHtml(capture.status) + '">' + escapeHtml(capture.statusLabel) + "</span>",
        '    <span class="hint-text">' + escapeHtml(new Date(capture.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })) + "</span>",
        "  </div>",
        '  <p class="list-card__title">' + escapeHtml(capture.text) + "</p>",
        '  <p class="list-card__copy">' + escapeHtml(targetCase ? targetCase.name : "0_INBOX") + "</p>",
        "</article>"
      ].join("");
    }).join("");
  }

  function findCase(caseId) {
    return state.cases.find(function (item) { return item.id === caseId; }) || null;
  }

  function refreshLinks() {
    var puddleJumperUrl = absoluteUrl(state.settings.puddleJumperUrl, "/");
    var logicOsUrl = absoluteUrl(state.settings.logicOsUrl, "https://os.publiclogic.org");
    var publicLogicUrl = absoluteUrl(state.settings.publicLogicUrl, "https://publiclogic.org");
    var operationsUrl = absoluteUrl(state.settings.operationsUrl, "/pj/admin");
    var dashboardUrl = operationsUrl.replace(/#.*$/, "") + "#dashboard";
    var guideUrl = absoluteUrl(state.settings.guideUrl, "/pj/guide");
    var intakeUrl = new URL("/prr.html", puddleJumperUrl).toString();
    var statusUrl = new URL("/prr-status.html", puddleJumperUrl).toString();
    var logicOsLink = byId("logicOsLink");
    var dashboardLink = byId("dashboardLink");
    var intakeLink = byId("intakeLink");
    var operationsLink = byId("operationsLink");
    var guideLink = byId("guideLink");
    var captureOpsLink = byId("captureOpsLink");
    var heroDashboardLink = byId("heroDashboardLink");
    var fastDashboardLink = byId("fastDashboardLink");
    var fastIntakeLink = byId("fastIntakeLink");
    var fastStatusLink = byId("fastStatusLink");
    var launchLogicOsLink = byId("launchLogicOsLink");
    var launchOperationsLink = byId("launchOperationsLink");
    var launchGuideLink = byId("launchGuideLink");
    var launchPublicLogicLink = byId("launchPublicLogicLink");
    var drawerLogicOsLink = byId("drawerLogicOsLink");
    var drawerDashboardLink = byId("drawerDashboardLink");
    var drawerIntakeLink = byId("drawerIntakeLink");
    var drawerGuideLink = byId("drawerGuideLink");
    var drawerPublicLogicLink = byId("drawerPublicLogicLink");

    if (logicOsLink) logicOsLink.href = logicOsUrl;
    if (dashboardLink) dashboardLink.href = dashboardUrl;
    if (intakeLink) intakeLink.href = intakeUrl;
    if (operationsLink) operationsLink.href = operationsUrl;
    if (guideLink) guideLink.href = guideUrl;
    if (captureOpsLink) captureOpsLink.href = operationsUrl;
    if (heroDashboardLink) heroDashboardLink.href = dashboardUrl;
    if (fastDashboardLink) fastDashboardLink.href = dashboardUrl;
    if (fastIntakeLink) fastIntakeLink.href = intakeUrl;
    if (fastStatusLink) fastStatusLink.href = statusUrl;
    if (launchLogicOsLink) launchLogicOsLink.href = logicOsUrl;
    if (launchOperationsLink) launchOperationsLink.href = operationsUrl;
    if (launchGuideLink) launchGuideLink.href = guideUrl;
    if (launchPublicLogicLink) launchPublicLogicLink.href = publicLogicUrl;
    if (drawerLogicOsLink) drawerLogicOsLink.href = logicOsUrl;
    if (drawerDashboardLink) drawerDashboardLink.href = dashboardUrl;
    if (drawerIntakeLink) drawerIntakeLink.href = intakeUrl;
    if (drawerGuideLink) drawerGuideLink.href = guideUrl;
    if (drawerPublicLogicLink) drawerPublicLogicLink.href = publicLogicUrl;
  }

  async function checkAuth() {
    try {
      var response = await fetch("/api/me", {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" })
      });

      if (!response.ok) {
        state.isAuthed = false;
        state.userName = "";
        setAuthState("public", "Public mode");
        return false;
      }

      var payload = await response.json().catch(function () {
        return null;
      });

      state.isAuthed = true;
      state.userName = payload && (payload.name || payload.email || payload.sub) ? (payload.name || payload.email || payload.sub) : "Operator";
      setAuthState("ready", "Signed in");
      return true;
    } catch (_error) {
      state.isAuthed = false;
      state.userName = "";
      setAuthState("public", "Public mode");
      return false;
    } finally {
      state.authReady = true;
    }
  }

  async function probeRuntime() {
    try {
      var baseUrl = absoluteUrl(state.settings.puddleJumperUrl, "/");
      var response = await fetch(new URL("/health", baseUrl).toString(), {
        credentials: "include",
        headers: { Accept: "application/json" }
      });
      var payload = await response.json().catch(function () {
        return null;
      });
      state.online = response.ok && payload && payload.status !== "error";
      setOnlineState(state.online ? "ok" : "warn", state.online ? "Live" : "Degraded");
    } catch (_error) {
      state.online = false;
      setOnlineState("error", "Offline");
    }
  }

  function normalizeRemoteTask(task) {
    return {
      id: task.id,
      title: task.title,
      detail: task.detail,
      priority: task.priority,
      domain: task.domain,
      actionUrl: task.actionUrl || state.settings.operationsUrl
    };
  }

  async function loadRemoteTasks() {
    if (!state.isAuthed) {
      state.usingRemoteTasks = false;
      state.remoteTasks = [];
      return;
    }

    try {
      var response = await fetch("/api/tasks", {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" })
      });

      if (!response.ok) {
        state.usingRemoteTasks = false;
        state.remoteTasks = [];
        return;
      }

      var payload = await response.json();
      var tasks = Array.isArray(payload.tasks) ? payload.tasks.map(normalizeRemoteTask) : [];
      state.remoteTasks = tasks.filter(function (task) {
        return state.dismissedRemoteTasks.indexOf(task.id) === -1;
      });
      state.usingRemoteTasks = true;
    } catch (_error) {
      state.usingRemoteTasks = false;
      state.remoteTasks = [];
    }
  }

  function normalizeRemoteCase(item) {
    return {
      id: item.id,
      name: item.name || "Untitled case",
      kicker: item.description || item.type || "Open in PJ Operations",
      color: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(item.color) ? item.color : "#10b981",
      pinned: false,
      lastOpened: item.last_accessed || item.lastAccessed || Date.now()
    };
  }

  async function loadRemoteCases() {
    if (!state.isAuthed) {
      state.usingRemoteCases = false;
      return;
    }

    try {
      var response = await fetch("/api/v1/casespaces", {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" })
      });

      if (!response.ok) {
        state.usingRemoteCases = false;
        return;
      }

      var payload = await response.json();
      if (!payload.success || !Array.isArray(payload.casespaces)) {
        state.usingRemoteCases = false;
        return;
      }

      state.cases = payload.casespaces.map(normalizeRemoteCase);
      state.usingRemoteCases = true;
    } catch (_error) {
      state.usingRemoteCases = false;
    }
  }

  function markRemoteTaskDismissed(taskId) {
    if (state.dismissedRemoteTasks.indexOf(taskId) === -1) {
      state.dismissedRemoteTasks.unshift(taskId);
    }
    state.remoteTasks = state.remoteTasks.filter(function (task) {
      return task.id !== taskId;
    });
    persistLocalState();
    renderAll();
  }

  function toggleLocalTask(taskId) {
    state.tasks = state.tasks.map(function (task) {
      if (task.id !== taskId) return task;
      var nextDone = !task.done;
      return {
        id: task.id,
        text: task.text,
        caseId: task.caseId,
        done: nextDone,
        completedAt: nextDone ? Date.now() : null
      };
    });
    persistLocalState();
    renderAll();
  }

  function openCase(caseId) {
    var item = findCase(caseId);
    if (!item) {
      window.location.href = absoluteUrl(state.settings.operationsUrl, "/pj/admin");
      return;
    }

    if (!state.usingRemoteCases) {
      state.cases = state.cases.map(function (candidate) {
        if (candidate.id !== caseId) return candidate;
        return Object.assign({}, candidate, { lastOpened: Date.now() });
      });
      persistLocalState();
    }

    window.location.href = absoluteUrl(state.settings.operationsUrl, "/pj/admin");
  }

  function handleCaptureSubmit(event) {
    event.preventDefault();

    var textNode = byId("captureText");
    var caseNode = byId("captureCase");
    if (!textNode || !caseNode) return;

    var text = textNode.value.trim();
    if (!text) return;

    var capture = {
      id: crypto.randomUUID(),
      text: text,
      caseId: caseNode.value || "",
      ts: Date.now(),
      status: "local",
      statusLabel: "Saved locally"
    };

    state.captures.unshift(capture);
    textNode.value = "";
    caseNode.value = "";
    persistLocalState();
    renderAll();
  }

  function populateSettingsForm() {
    var pjUrl = byId("settingsPjUrl");
    var logicOsUrl = byId("settingsLogicOsUrl");
    var publicLogicUrl = byId("settingsPublicLogicUrl");
    var opsUrl = byId("settingsOpsUrl");
    var guideUrl = byId("settingsGuideUrl");
    var aiModel = byId("settingsAiModel");
    var aiEnabled = byId("settingsAiEnabled");

    if (pjUrl) pjUrl.value = state.settings.puddleJumperUrl;
    if (logicOsUrl) logicOsUrl.value = state.settings.logicOsUrl;
    if (publicLogicUrl) publicLogicUrl.value = state.settings.publicLogicUrl;
    if (opsUrl) opsUrl.value = state.settings.operationsUrl;
    if (guideUrl) guideUrl.value = state.settings.guideUrl;
    if (aiModel) aiModel.value = state.settings.aiModel;
    if (aiEnabled) aiEnabled.checked = Boolean(state.settings.aiEnabled);
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();

    var pjUrl = byId("settingsPjUrl");
    var logicOsUrl = byId("settingsLogicOsUrl");
    var publicLogicUrl = byId("settingsPublicLogicUrl");
    var opsUrl = byId("settingsOpsUrl");
    var guideUrl = byId("settingsGuideUrl");
    var aiModel = byId("settingsAiModel");
    var aiEnabled = byId("settingsAiEnabled");

    state.settings = {
      puddleJumperUrl: pjUrl ? pjUrl.value.trim() || DEFAULT_SETTINGS.puddleJumperUrl : DEFAULT_SETTINGS.puddleJumperUrl,
      logicOsUrl: logicOsUrl ? logicOsUrl.value.trim() || DEFAULT_SETTINGS.logicOsUrl : DEFAULT_SETTINGS.logicOsUrl,
      publicLogicUrl: publicLogicUrl ? publicLogicUrl.value.trim() || DEFAULT_SETTINGS.publicLogicUrl : DEFAULT_SETTINGS.publicLogicUrl,
      operationsUrl: opsUrl ? opsUrl.value.trim() || DEFAULT_SETTINGS.operationsUrl : DEFAULT_SETTINGS.operationsUrl,
      guideUrl: guideUrl ? guideUrl.value.trim() || DEFAULT_SETTINGS.guideUrl : DEFAULT_SETTINGS.guideUrl,
      aiModel: aiModel ? aiModel.value : DEFAULT_SETTINGS.aiModel,
      aiEnabled: Boolean(aiEnabled && aiEnabled.checked)
    };

    refreshLinks();
    persistLocalState();
    probeRuntime();
  }

  function renderAll() {
    refreshLinks();
    populateSettingsForm();
    renderTasks();
    renderCases();
    renderCaptures();
    updateSummary();
  }

  function openDrawer(id) {
    var drawer = byId(id);
    if (!drawer) return;
    drawer.hidden = false;
    document.body.classList.add("drawer-open");
  }

  function closeDrawer(id) {
    var drawer = byId(id);
    if (!drawer) return;
    drawer.hidden = true;
    if (byId("quickActions").hidden && byId("auth-gate").hidden) {
      document.body.classList.remove("drawer-open");
    }
  }

  function handleJwtSubmit() {
    var input = byId("jwtInput");
    if (!input) return;
    var token = input.value.trim();
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
    closeDrawer("auth-gate");
    bootData();
  }

  function handleJwtClear() {
    var input = byId("jwtInput");
    if (input) input.value = "";
    localStorage.removeItem(TOKEN_KEY);
    state.isAuthed = false;
    state.usingRemoteTasks = false;
    state.usingRemoteCases = false;
    state.remoteTasks = [];
    setAuthState("public", "Public mode");
    renderAll();
  }

  async function bootData() {
    await Promise.all([checkAuth(), probeRuntime()]);
    await Promise.all([loadRemoteTasks(), loadRemoteCases()]);
    renderAll();
  }

  function bindEvents() {
    Array.prototype.forEach.call(document.querySelectorAll(".bottom-nav__item"), function (button) {
      button.addEventListener("click", function () {
        showTab(button.dataset.tab);
      });
    });

    byId("signInBtn").addEventListener("click", function () { openDrawer("auth-gate"); });
    byId("drawerSignInBtn").addEventListener("click", function () {
      closeDrawer("quickActions");
      openDrawer("auth-gate");
    });
    byId("commandBtn").addEventListener("click", function () { openDrawer("quickActions"); });
    byId("closeDrawerBtn").addEventListener("click", function () { closeDrawer("quickActions"); });
    byId("authClose").addEventListener("click", function () { closeDrawer("auth-gate"); });
    byId("heroCaptureBtn").addEventListener("click", function () { showTab("capture"); });
    byId("refreshBtn").addEventListener("click", bootData);
    byId("captureForm").addEventListener("submit", handleCaptureSubmit);
    byId("settingsForm").addEventListener("submit", handleSettingsSubmit);
    byId("authSubmit").addEventListener("click", handleJwtSubmit);
    byId("authClear").addEventListener("click", handleJwtClear);

    document.addEventListener("click", function (event) {
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (target.dataset.closeDrawer === "true") {
        closeDrawer("quickActions");
      }

      if (target.dataset.authClose === "true") {
        closeDrawer("auth-gate");
      }

      if (target.dataset.action === "toggle-task") {
        toggleLocalTask(target.dataset.taskId);
      }

      if (target.dataset.action === "open-case") {
        openCase(target.dataset.caseId);
      }

      if (target.dataset.action === "dismiss-remote-task") {
        markRemoteTaskDismissed(target.dataset.taskId);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeDrawer("quickActions");
        closeDrawer("auth-gate");
      }
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    loadState();
    bindEvents();
    showTab("today");
    renderAll();
    bootData();
  });
})();
