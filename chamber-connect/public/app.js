const state = {
  config: null,
  cases: [],
  currentView: "dashboard",
  currentUser: null,
  currentCase: null
};

const views = {
  dashboard: document.getElementById("dashboard"),
  queue: document.getElementById("queue"),
  caseDetail: document.getElementById("caseDetail"),
  intake: document.getElementById("intake")
};

const viewTitle = document.getElementById("viewTitle");
const viewSubtitle = document.getElementById("viewSubtitle");
const caseCount = document.getElementById("caseCount");
const userSelect = document.getElementById("userSelect");
const navButtons = document.querySelectorAll(".nav-btn");

function headers() {
  if (!state.currentUser) return {};
  return {
    "X-Role": state.currentUser.role,
    "X-User-Id": state.currentUser.user_id
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...headers(),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }
  return response.json();
}

async function loadConfig() {
  state.config = await fetchJson("/api/config");
  userSelect.innerHTML = "";
  state.config.users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.user_id;
    option.textContent = `${user.name} — ${user.role}`;
    userSelect.appendChild(option);
  });
  state.currentUser = state.config.users[0];
  userSelect.value = state.currentUser.user_id;

  const municipalitySelect = document.getElementById("municipalitySelect");
  municipalitySelect.innerHTML = "<option value=\"\">Unspecified</option>";
  state.config.municipalities.municipalities.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    municipalitySelect.appendChild(option);
  });

  const categorySelect = document.getElementById("categorySelect");
  const subcategorySelect = document.getElementById("subcategorySelect");
  categorySelect.innerHTML = "";
  state.config.taxonomy.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.name;
    option.textContent = category.name;
    categorySelect.appendChild(option);
  });

  function updateSubcategories() {
    const selected = state.config.taxonomy.categories.find(
      (category) => category.name === categorySelect.value
    );
    subcategorySelect.innerHTML = "";
    (selected?.subcategories || []).forEach((sub) => {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      subcategorySelect.appendChild(option);
    });
  }

  categorySelect.addEventListener("change", updateSubcategories);
  updateSubcategories();
}

async function loadCases() {
  state.cases = await fetchJson("/api/cases");
  caseCount.textContent = `${state.cases.length} active cases`;
  renderMetrics();
  renderCaseTable();
}

function renderMetrics() {
  const metrics = document.getElementById("metrics");
  const triage = state.cases.filter((c) => c.state === "TRIAGE").length;
  const atRisk = state.cases.filter((c) => c.sla_status === "at_risk").length;
  const breached = state.cases.filter((c) => c.sla_status === "breached").length;
  const waiting = state.cases.filter((c) => c.state.startsWith("WAITING")).length;

  const cards = [
    { title: "Triage Queue", value: triage, note: "Needs classification + routing" },
    { title: "At-Risk", value: atRisk, note: "SLA approaching breach" },
    { title: "Breached", value: breached, note: "Immediate escalation" },
    { title: "Waiting", value: waiting, note: "Paused SLA cases" }
  ];

  metrics.innerHTML = "";
  cards.forEach((card, index) => {
    const el = document.createElement("div");
    el.className = "card";
    el.style.animationDelay = `${index * 0.06}s`;
    el.innerHTML = `<h3>${card.value}</h3><p>${card.title}</p><p>${card.note}</p>`;
    metrics.appendChild(el);
  });
}

function renderCaseTable() {
  const table = document.getElementById("caseTable");
  table.innerHTML = "";
  state.cases.forEach((caseRecord) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a class="case-link" href="#" data-case="${caseRecord.case_id}">${caseRecord.case_ref}</a></td>
      <td>${caseRecord.subject}</td>
      <td>${caseRecord.state}</td>
      <td>${caseRecord.sla_status}</td>
      <td>${caseRecord.assigned_team || "Unassigned"}</td>
    `;
    row.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      openCase(caseRecord.case_id);
    });
    table.appendChild(row);
  });
}

function renderQueue(queueKey) {
  const queueTitle = document.getElementById("queueTitle");
  const queueTable = document.getElementById("queueTable");
  const labelMap = {
    triage: "Triage Queue",
    "at-risk": "At-Risk Queue",
    breached: "Breached Queue"
  };
  queueTitle.textContent = labelMap[queueKey] || "Queue";
  queueTable.innerHTML = "";

  let filtered = [];
  if (queueKey === "triage") filtered = state.cases.filter((c) => c.state === "TRIAGE");
  if (queueKey === "at-risk") filtered = state.cases.filter((c) => c.sla_status === "at_risk");
  if (queueKey === "breached") filtered = state.cases.filter((c) => c.sla_status === "breached");

  filtered.forEach((caseRecord) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><a class="case-link" href="#" data-case="${caseRecord.case_id}">${caseRecord.case_ref}</a></td>
      <td>${caseRecord.subject}</td>
      <td>${caseRecord.state}</td>
      <td>${caseRecord.sla_status}</td>
      <td>${caseRecord.assigned_team || "Unassigned"}</td>
    `;
    row.querySelector("a").addEventListener("click", (event) => {
      event.preventDefault();
      openCase(caseRecord.case_id);
    });
    queueTable.appendChild(row);
  });
}

function setView(view) {
  state.currentView = view;
  Object.values(views).forEach((section) => (section.hidden = true));

  if (view === "dashboard") {
    views.dashboard.hidden = false;
    viewTitle.textContent = "Case Dashboard";
    viewSubtitle.textContent = "Unified intake, routing, SLA, and audit for every inquiry.";
  }

  if (["triage", "at-risk", "breached"].includes(view)) {
    views.queue.hidden = false;
    viewTitle.textContent = "Queue View";
    viewSubtitle.textContent = "Prioritized cases based on SLA and governance rules.";
    renderQueue(view);
  }

  if (view === "intake") {
    views.intake.hidden = false;
    viewTitle.textContent = "New Intake";
    viewSubtitle.textContent = "Capture inquiries with governance-first defaults.";
  }

  if (view === "caseDetail") {
    views.caseDetail.hidden = false;
  }

  navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

async function openCase(caseId) {
  const detail = await fetchJson(`/api/cases/${caseId}`);
  state.currentCase = detail;

  document.getElementById("detailRef").textContent = detail.case_ref;
  document.getElementById("detailSummary").textContent = detail.subject;
  document.getElementById("detailState").textContent = `${detail.state} • SLA ${detail.sla_status}`;

  renderCaseActions(detail);
  renderCaseTabs(detail);
  setView("caseDetail");
}

function renderCaseActions(caseRecord) {
  const actions = document.getElementById("caseActions");
  actions.innerHTML = "";

  const buttons = [
    { label: "Route Now", action: () => routeCase(caseRecord.case_id) },
    { label: "Assign Owner", action: () => assignCase(caseRecord.case_id) },
    { label: "Change State", action: () => changeState(caseRecord.case_id) },
    { label: "Pause SLA", action: () => pauseSla(caseRecord.case_id) },
    { label: "Send Response", action: () => logComm(caseRecord.case_id), style: "secondary" },
    { label: "Close Case", action: () => closeCase(caseRecord.case_id), style: "danger" }
  ];

  buttons.forEach((btn) => {
    const button = document.createElement("button");
    button.textContent = btn.label;
    if (btn.style) button.classList.add(btn.style);
    button.addEventListener("click", btn.action);
    actions.appendChild(button);
  });
}

function renderCaseTabs(caseRecord) {
  const tabs = document.getElementById("detailTabs");
  const content = document.getElementById("detailContent");
  const tabList = [
    { key: "summary", label: "Summary" },
    { key: "timeline", label: "Timeline" },
    { key: "tasks", label: "Tasks" },
    { key: "knowledge", label: "Knowledge" },
    { key: "audit", label: "Audit" }
  ];

  tabs.innerHTML = "";
  tabList.forEach((tab, index) => {
    const button = document.createElement("button");
    button.textContent = tab.label;
    button.classList.toggle("active", index === 0);
    button.addEventListener("click", () => {
      document.querySelectorAll("#detailTabs button").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      renderTab(tab.key, caseRecord, content);
    });
    tabs.appendChild(button);
  });

  renderTab("summary", caseRecord, content);
}

function renderTab(tabKey, caseRecord, container) {
  if (tabKey === "summary") {
    container.innerHTML = `
      <div class="detail-grid">
        <div><strong>Requestor</strong>${caseRecord.requestor_name}</div>
        <div><strong>Organization</strong>${caseRecord.requestor_org || "—"}</div>
        <div><strong>Contact</strong>${caseRecord.requestor_email}</div>
        <div><strong>Municipality</strong>${caseRecord.municipality_affiliation || "—"}</div>
        <div><strong>Category</strong>${caseRecord.category || "Unclassified"}</div>
        <div><strong>Assigned Team</strong>${caseRecord.assigned_team || "Unassigned"}</div>
        <div><strong>Priority</strong>${caseRecord.priority}</div>
        <div><strong>Complexity</strong>${caseRecord.complexity}</div>
        <div><strong>SLA Due</strong>${new Date(caseRecord.sla_due_at).toLocaleString()}</div>
      </div>
    `;
  }

  if (tabKey === "timeline") {
    const items = caseRecord.events
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(
        (event) => `
      <div class="timeline-item">
        <strong>${event.event_type}</strong>
        <span>${new Date(event.timestamp).toLocaleString()}</span>
        <span>${event.notes || ""}</span>
      </div>
    `
      )
      .join("");
    container.innerHTML = `<div class="timeline">${items || "No events yet."}</div>`;
  }

  if (tabKey === "tasks") {
    const items = caseRecord.tasks
      .map(
        (task) => `
      <div class="timeline-item">
        <strong>${task.title}</strong>
        <span>Status: ${task.status}</span>
        <span>Due: ${task.due_at ? new Date(task.due_at).toLocaleString() : "—"}</span>
      </div>
    `
      )
      .join("");
    container.innerHTML = `<div class="timeline">${items || "No tasks yet."}</div>`;
  }

  if (tabKey === "knowledge") {
    const items = (caseRecord.knowledge_base_matches || [])
      .map((kb) => `<div class="timeline-item"><strong>${kb}</strong><span>Governed response template</span></div>`)
      .join("");
    container.innerHTML = `<div class="timeline">${items || "No KB matches yet."}</div>`;
  }

  if (tabKey === "audit") {
    const items = caseRecord.events
      .filter((event) => event.visibility === "internal")
      .map(
        (event) => `
      <div class="timeline-item">
        <strong>${event.event_type}</strong>
        <span>${new Date(event.timestamp).toLocaleString()}</span>
        <span>${event.notes || ""}</span>
      </div>
    `
      )
      .join("");
    container.innerHTML = `<div class="timeline">${items || "No audit events."}</div>`;
  }
}

async function routeCase(caseId) {
  try {
    await fetchJson(`/api/cases/${caseId}/route`, { method: "POST" });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function assignCase(caseId) {
  const assigned_owner_user_id = prompt("Enter user id to assign (e.g., u-staff):");
  if (!assigned_owner_user_id) return;
  try {
    await fetchJson(`/api/cases/${caseId}/assign`, {
      method: "POST",
      body: JSON.stringify({ assigned_owner_user_id })
    });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function changeState(caseId) {
  const next = prompt("Enter next state (TRIAGE, ROUTED, IN_PROGRESS, WAITING_ON_REQUESTOR, WAITING_ON_EXTERNAL, RESOLVED_PENDING_CONFIRMATION, CLOSED, REOPENED):");
  if (!next) return;
  let payload = { state: next };
  if (next.startsWith("WAITING")) {
    const reason = prompt("Enter SLA pause reason (waiting_on_requestor, external_dependency, other):");
    payload.sla_pause_reason = reason;
  }
  try {
    await fetchJson(`/api/cases/${caseId}/transition`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function pauseSla(caseId) {
  const reason = prompt("Enter SLA pause reason (waiting_on_requestor, external_dependency, other):");
  if (!reason) return;
  try {
    await fetchJson(`/api/cases/${caseId}/transition`, {
      method: "POST",
      body: JSON.stringify({ state: "WAITING_ON_REQUESTOR", sla_pause_reason: reason })
    });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function logComm(caseId) {
  const body = prompt("Enter response summary:");
  if (!body) return;
  try {
    await fetchJson(`/api/cases/${caseId}/comm`, {
      method: "POST",
      body: JSON.stringify({
        direction: "outbound",
        channel: "email",
        body,
        public_safe: true
      })
    });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function closeCase(caseId) {
  const resolution_summary = prompt("Resolution summary:");
  if (!resolution_summary) return;
  const resolution_type = prompt("Resolution type (info_provided, routed_to_municipality, appointment_scheduled, permit_guidance, other):");
  if (!resolution_type) return;
  try {
    await fetchJson(`/api/cases/${caseId}/transition`, {
      method: "POST",
      body: JSON.stringify({ state: "CLOSED", resolution_summary, resolution_type })
    });
    await refreshCase(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function refreshCase(caseId) {
  await loadCases();
  await openCase(caseId);
}

async function handleIntake(event) {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form).entries());
  data.contact_consent = true;
  data.intake_channel = "web form";
  data.classification_confidence = 0.75;
  await fetchJson("/api/cases", { method: "POST", body: JSON.stringify(data) });
  form.reset();
  await loadCases();
  setView("dashboard");
}

userSelect.addEventListener("change", () => {
  const user = state.config.users.find((u) => u.user_id === userSelect.value);
  state.currentUser = user;
  loadCases();
});

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => setView(btn.dataset.view));
});

const intakeForm = document.getElementById("intakeForm");
intakeForm.addEventListener("submit", handleIntake);

document.getElementById("intakeReset").addEventListener("click", () => intakeForm.reset());

(async function init() {
  await loadConfig();
  await loadCases();
  setView("dashboard");
})();
