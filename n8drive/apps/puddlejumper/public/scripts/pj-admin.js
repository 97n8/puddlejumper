// ── State ─────────────────────────────────────────────────────────────────
let currentPage = 0;
const PAGE_SIZE = 20;
let sortField = "created_at";
let sortDir = -1; // -1 = newest first
let approvals = [];
let authenticated = false;
let userRole = null; // 'admin' | 'viewer' | null

// ── API helpers ───────────────────────────────────────────────────────────
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getCookie("pj_token") || localStorage.getItem("pj_token");
  if (token) headers["Authorization"] = "Bearer " + token;
  const csrf = getCookie("csrf_token");
  if (csrf) headers["x-csrf-token"] = csrf;
  return headers;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: authHeaders(), ...opts });
  if (res.status === 401 || res.status === 403) {
    showAuthGate();
    throw new Error("Unauthorized");
  }
  return res.json();
}

// ── Auth gate ─────────────────────────────────────────────────────────────
function showAuthGate() {
  authenticated = false;
  document.getElementById("auth-gate").classList.remove("hidden");
  document.querySelectorAll(".main").forEach(el => el.classList.add("hidden"));
  document.querySelector(".tabs").classList.add("hidden");
}

function hideAuthGate() {
  authenticated = true;
  document.getElementById("auth-gate").classList.add("hidden");
  document.querySelector(".tabs").classList.remove("hidden");
  // Apply role class
  if (userRole && userRole !== "admin") {
    document.body.classList.add("role-viewer");
  } else {
    document.body.classList.remove("role-viewer");
  }
  // Show the active tab
  const active = document.querySelector(".tab.active").dataset.tab;
  switchTab(active);
}

// ── Tabs ──────────────────────────────────────────────────────────────────
const TAB_HASH_MAP = { queue: "approvals", chains: "templates", dashboard: "dashboard", prr: "prr", members: "members" };
const HASH_TAB_MAP = Object.fromEntries(Object.entries(TAB_HASH_MAP).map(([k, v]) => [v, k]));

function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".main").forEach(el => el.classList.add("hidden"));
  const el = document.getElementById("tab-" + tab);
  if (el) el.classList.remove("hidden");
  // Update URL hash
  const hash = TAB_HASH_MAP[tab] || tab;
  if (window.location.hash !== "#" + hash) {
    history.replaceState(null, "", "#" + hash);
  }
  if (tab === "queue") loadApprovals();
  if (tab === "dashboard") loadStats();
  if (tab === "chains") loadTemplates();
  if (tab === "prr") loadPRRQueue();
  if (tab === "members") { loadMembers(); loadUsage(); }
}

// ── Approval Queue ────────────────────────────────────────────────────────
async function loadApprovals() {
  const status = document.getElementById("status-filter").value;
  const qs = status ? `?status=${status}&limit=${PAGE_SIZE}&offset=${currentPage * PAGE_SIZE}` :
                       `?limit=${PAGE_SIZE}&offset=${currentPage * PAGE_SIZE}`;
  const loading = document.getElementById("approvals-loading");
  if (loading) loading.classList.remove("hidden");
  try {
    const json = await api("/api/approvals" + qs);
    if (loading) loading.classList.add("hidden");
    if (!json.success) { showToast(json.error || "Failed to load", "error"); return; }
    hideAuthGate();
    approvals = json.data.approvals;
    renderApprovals();
    renderPagination(json.data.pendingCount, json.data.total);
  } catch (e) {
    if (loading) loading.classList.add("hidden");
    if (e.message !== "Unauthorized") showToast("Failed to load approvals", "error");
  }
}

function renderApprovals() {
  const tbody = document.getElementById("approvals-body");
  const empty = document.getElementById("empty-state");
  if (approvals.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  // Sort client-side
  const sorted = [...approvals].sort((a, b) => {
    let va = a[sortField], vb = b[sortField];
    if (sortField === "chain") {
      va = a.chainSummary ? a.chainSummary.completedSteps : -1;
      vb = b.chainSummary ? b.chainSummary.completedSteps : -1;
    }
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  tbody.innerHTML = sorted.map(a => {
    const chain = a.chainSummary;
    let chainHtml;
    if (chain) {
      // Show parallel-aware progress: multiple active steps shown
      const activeCount = chain.activeSteps || 0;
      const parallelHint = activeCount > 1 ? ` <span class="parallel-hint" title="${activeCount} steps active in parallel">⊕${activeCount}</span>` : "";
      chainHtml = `<div class="chain-progress">
           <div class="chain-bar"><div class="chain-bar-fill" style="width:${(chain.completedSteps / chain.totalSteps * 100)}%"></div></div>
           <span>${chain.completedSteps}/${chain.totalSteps}${parallelHint}</span>
           ${chain.currentStepLabel ? `<span class="text-dim">· ${esc(chain.currentStepLabel)}</span>` : ""}
         </div>`;
    } else {
      chainHtml = `<span class="text-dim">—</span>`;
    }

    const actions = [];
    if (a.approval_status === "pending") {
      actions.push(`<button class="btn btn-approve" onclick="decide('${a.id}','approved')">Approve</button>`);
      actions.push(`<button class="btn btn-reject" onclick="decide('${a.id}','rejected')">Reject</button>`);
    }
    if (a.approval_status === "approved") {
      actions.push(`<button class="btn btn-dispatch" onclick="dispatch('${a.id}')">Dispatch</button>`);
    }

    return `<tr onclick="showDetail('${a.id}')" class="cursor-pointer">
      <td>${esc(a.action_intent || "—")}</td>
      <td><span class="status-badge ${a.approval_status}">${a.approval_status}</span></td>
      <td>${chainHtml}</td>
      <td>${esc(a.operator_id || "—")}</td>
      <td>${timeAgo(a.created_at)}</td>
      <td class="actions" onclick="event.stopPropagation()">${actions.join("") || "—"}</td>
    </tr>`;
  }).join("");
}

function renderPagination(pendingCount, total) {
  document.getElementById("page-info").textContent =
    `Showing ${approvals.length} result${approvals.length !== 1 ? "s" : ""} · ${pendingCount} pending total`;
  document.getElementById("prev-btn").disabled = currentPage === 0;
  document.getElementById("next-btn").disabled = approvals.length < PAGE_SIZE;
}

function prevPage() { if (currentPage > 0) { currentPage--; loadApprovals(); } }
function nextPage() { currentPage++; loadApprovals(); }
function sortBy(field) {
  if (sortField === field) sortDir *= -1;
  else { sortField = field; sortDir = field === "created_at" ? -1 : 1; }
  renderApprovals();
}

// ── Decide / Dispatch ─────────────────────────────────────────────────────
async function decide(id, status) {
  try {
    const json = await api(`/api/approvals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    if (!json.success) { showToast(json.error || "Decision failed", "error"); return; }
    showToast(`Approval ${status}`, "success");
    loadApprovals();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Decision failed", "error");
  }
}

async function dispatch(id) {
  try {
    const json = await api(`/api/approvals/${id}/dispatch`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!json.success) { showToast(json.error || "Dispatch failed", "error"); return; }
    showToast("Dispatched successfully", "success");
    loadApprovals();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Dispatch failed", "error");
  }
}

// ── Detail panel ──────────────────────────────────────────────────────────
async function showDetail(id) {
  const overlay = document.getElementById("detail-overlay");
  const content = document.getElementById("detail-content");
  overlay.classList.add("open");

  content.innerHTML = "<p>Loading…</p>";

  try {
    const [approvalJson, chainJson] = await Promise.all([
      api(`/api/approvals/${id}`),
      api(`/api/approvals/${id}/chain`).catch(() => null),
    ]);

    if (!approvalJson.success) { content.innerHTML = "<p>Failed to load</p>"; return; }
    const a = approvalJson.data;
    const chain = chainJson?.data;

    let html = `
      <div class="detail-section">
        <h4>Overview</h4>
        <div class="detail-field"><span class="lbl">ID</span><span class="mono-sm">${esc(a.id)}</span></div>
        <div class="detail-field"><span class="lbl">Status</span><span class="status-badge ${a.approval_status}">${a.approval_status}</span></div>
        <div class="detail-field"><span class="lbl">Intent</span><span>${esc(a.action_intent || "—")}</span></div>
        <div class="detail-field"><span class="lbl">Mode</span><span>${esc(a.action_mode || "—")}</span></div>
        <div class="detail-field"><span class="lbl">Operator</span><span>${esc(a.operator_id || "—")}</span></div>
        <div class="detail-field"><span class="lbl">Created</span><span>${new Date(a.created_at).toLocaleString()}</span></div>
        <div class="detail-field"><span class="lbl">Expires</span><span>${new Date(a.expires_at).toLocaleString()}</span></div>
        ${a.approver_id ? `<div class="detail-field"><span class="lbl">Approver</span><span>${esc(a.approver_id)}</span></div>` : ""}
        ${a.approval_note ? `<div class="detail-field"><span class="lbl">Note</span><span>${esc(a.approval_note)}</span></div>` : ""}
      </div>`;

    if (chain) {
      // Group steps by order for parallel visualization
      const stepsByOrder = {};
      chain.steps.forEach(s => {
        if (!stepsByOrder[s.order]) stepsByOrder[s.order] = [];
        stepsByOrder[s.order].push(s);
      });

      html += `
        <div class="detail-section">
          <h4>Chain Progress — ${esc(chain.templateName)}</h4>
          <div class="chain-progress chain-progress-mb">
            <div class="chain-bar chain-bar-full"><div class="chain-bar-fill" style="width:${(chain.completedSteps / chain.totalSteps * 100)}%"></div></div>
            <span>${chain.completedSteps} of ${chain.totalSteps} steps complete</span>
          </div>
          <ul class="chain-steps-list">
            ${chain.steps.map(s => {
              const siblings = stepsByOrder[s.order];
              const isParallel = siblings && siblings.length > 1;
              return `
              <li>
                <span class="step-dot ${s.status}"></span>
                <span>
                  <strong>${esc(s.label)}</strong>
                  ${isParallel ? '<span class="parallel-hint-ml" title="Parallel step">⊕</span>' : ''}
                  — <span class="status-badge ${s.status}">${s.status}</span>
                </span>
                ${s.deciderId ? `<span class="step-decider">${esc(s.deciderId)} · ${timeAgo(s.decidedAt)}</span>` : ""}
              </li>`;
            }).join("")}
          </ul>
        </div>`;
    }

    if (a.plan && Array.isArray(a.plan)) {
      html += `
        <div class="detail-section">
          <h4>Plan (${a.plan.length} step${a.plan.length !== 1 ? "s" : ""})</h4>
          <pre class="code-block">${esc(JSON.stringify(a.plan, null, 2))}</pre>
        </div>`;
    }

    if (a.dispatchResult) {
      html += `
        <div class="detail-section">
          <h4>Dispatch Result</h4>
          <pre class="code-block">${esc(JSON.stringify(a.dispatchResult, null, 2))}</pre>
        </div>`;
    }

    // Action buttons in detail
    if (a.approval_status === "pending") {
      html += `
        <div class="form-actions">
          <button class="btn btn-approve" onclick="decide('${a.id}','approved');closeDetail()">Approve</button>
          <button class="btn btn-reject" onclick="decide('${a.id}','rejected');closeDetail()">Reject</button>
        </div>`;
    }
    if (a.approval_status === "approved") {
      html += `
        <div class="detail-actions-mt">
          <button class="btn btn-dispatch" onclick="dispatch('${a.id}');closeDetail()">Dispatch</button>
        </div>`;
    }

    content.innerHTML = html;
  } catch (e) {
    if (e.message !== "Unauthorized") content.innerHTML = "<p>Failed to load details</p>";
  }
}

function closeDetail(e) {
  if (e && e.target !== document.getElementById("detail-overlay")) return;
  document.getElementById("detail-overlay").classList.remove("open");
}

// ── Chain Templates ───────────────────────────────────────────────────────
async function loadTemplates() {
  const loading = document.getElementById("templates-loading");
  const grid = document.getElementById("templates-grid");
  const empty = document.getElementById("templates-empty");
  if (loading) loading.classList.remove("hidden");
  if (grid) grid.innerHTML = "";
  if (empty) empty.classList.add("hidden");
  try {
    const json = await api("/api/chain-templates");
    if (loading) loading.classList.add("hidden");
    if (!json.success) { showToast(json.error || "Failed to load templates", "error"); return; }
    hideAuthGate();
    renderTemplates(json.data);
  } catch (e) {
    if (loading) loading.classList.add("hidden");
    if (e.message !== "Unauthorized") showToast("Failed to load templates", "error");
  }
}

function renderTemplates(templates) {
  const grid = document.getElementById("templates-grid");
  const empty = document.getElementById("templates-empty");
  if (!templates || templates.length === 0) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = templates.map(t => {
    const steps = t.steps || [];
    // Group by order for parallel visualization
    const byOrder = {};
    steps.forEach(s => {
      if (!byOrder[s.order]) byOrder[s.order] = [];
      byOrder[s.order].push(s);
    });
    const orders = Object.keys(byOrder).sort((a, b) => Number(a) - Number(b));

    let vizHtml = "";
    orders.forEach((ord, i) => {
      const group = byOrder[ord];
      if (i > 0) vizHtml += `<span class="step-arrow">→</span>`;
      if (group.length > 1) {
        // Parallel group
        vizHtml += `<div class="step-group">
          <span class="parallel-bracket">⊕ parallel</span>
          ${group.map(s => `<span class="step-pill parallel">${esc(s.label)}</span>`).join("")}
        </div>`;
      } else {
        vizHtml += `<span class="step-pill">${esc(group[0].label)}</span>`;
      }
    });

    const isDefault = t.id === "default";
    const created = t.created_at ? new Date(t.created_at).toLocaleDateString() : "";

    return `<div class="template-card">
      ${isDefault ? '<span class="template-default">Default</span>' : ""}
      <div class="template-name">${esc(t.name)}</div>
      <div class="template-id">${esc(t.id)}</div>
      <div class="template-meta">${steps.length} step${steps.length !== 1 ? "s" : ""} · ${orders.length} stage${orders.length !== 1 ? "s" : ""}${created ? " · Created " + created : ""}</div>
      <div class="template-steps-viz">${vizHtml}</div>
      <div class="template-actions">
        <button class="btn btn-secondary" onclick="showTemplateDetail('${esc(t.id)}')">View JSON</button>
        ${!isDefault ? `<button class="btn btn-secondary" onclick="editTemplate('${esc(t.id)}')">Edit</button>` : ""}
        ${!isDefault ? `<button class="btn btn-danger" onclick="deleteTemplate('${esc(t.id)}')">Delete</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

async function showTemplateDetail(id) {
  const overlay = document.getElementById("detail-overlay");
  const content = document.getElementById("detail-content");
  document.getElementById("detail-title").textContent = "Template Detail";
  overlay.classList.add("open");
  content.innerHTML = "<p>Loading…</p>";
  try {
    const json = await api(`/api/chain-templates/${encodeURIComponent(id)}`);
    if (!json.success) { content.innerHTML = "<p>Failed to load</p>"; return; }
    const t = json.data;
    content.innerHTML = `
      <div class="detail-section">
        <h4>Template</h4>
        <div class="detail-field"><span class="lbl">ID</span><span class="mono-sm">${esc(t.id)}</span></div>
        <div class="detail-field"><span class="lbl">Name</span><span>${esc(t.name)}</span></div>
        <div class="detail-field"><span class="lbl">Steps</span><span>${(t.steps || []).length}</span></div>
      </div>
      <div class="detail-section">
        <h4>Definition</h4>
        <pre class="code-block code-block-tall">${esc(JSON.stringify(t, null, 2))}</pre>
      </div>`;
  } catch (e) {
    if (e.message !== "Unauthorized") content.innerHTML = "<p>Failed to load</p>";
  }
}

async function deleteTemplate(id) {
  if (!confirm(`Delete template "${id}"?`)) return;
  try {
    const json = await api(`/api/chain-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!json.success) { showToast(json.error || "Delete failed", "error"); return; }
    showToast("Template deleted", "success");
    loadTemplates();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Delete failed", "error");
  }
}

// ── Create / Edit Template Form ──────────────────────────────────────────
let templateStepCounter = 0;

function toggleCreateTemplateForm() {
  const wrap = document.getElementById("template-form-wrap");
  if (wrap.classList.contains("hidden")) {
    document.getElementById("template-form-title").textContent = "Create Template";
    document.getElementById("template-edit-id").value = "";
    document.getElementById("template-name").value = "";
    document.getElementById("template-description").value = "";
    templateStepCounter = 0;
    document.getElementById("template-steps-list").innerHTML = "";
    addTemplateStep(); // Start with one step
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

function cancelTemplateForm() {
  document.getElementById("template-form-wrap").classList.add("hidden");
}

function addTemplateStep() {
  const list = document.getElementById("template-steps-list");
  const idx = templateStepCounter++;
  const stepNum = list.children.length + 1;
  const div = document.createElement("div");
  div.id = `step-row-${idx}`;
  div.className = "step-row";
  div.innerHTML = `
    <span class="step-number">Step ${stepNum}</span>
    <input type="text" placeholder="Role (e.g. admin)" class="step-role step-input-role">
    <input type="text" placeholder="Label (e.g. Legal Review)" class="step-label step-input-label">
    <button class="btn btn-danger btn-sm" onclick="removeTemplateStep('step-row-${idx}')">✕</button>
  `;
  list.appendChild(div);
}

function removeTemplateStep(rowId) {
  const el = document.getElementById(rowId);
  if (el) el.remove();
  // Re-number visible steps (1-based for display)
  const list = document.getElementById("template-steps-list");
  Array.from(list.children).forEach((row, i) => {
    const label = row.querySelector("span");
    if (label) label.textContent = `Step ${i + 1}`;
  });
}

async function submitTemplate() {
  const editId = document.getElementById("template-edit-id").value;
  const name = document.getElementById("template-name").value.trim();
  const description = document.getElementById("template-description").value.trim();
  if (!name) { showToast("Template name is required", "error"); return; }

  const stepRows = document.getElementById("template-steps-list").children;
  if (stepRows.length === 0) { showToast("At least one step is required", "error"); return; }

  const steps = [];
  for (let i = 0; i < stepRows.length; i++) {
    const role = stepRows[i].querySelector(".step-role").value.trim();
    const label = stepRows[i].querySelector(".step-label").value.trim();
    if (!role || !label) { showToast(`Step ${i + 1}: role and label are required`, "error"); return; }
    steps.push({ order: i, requiredRole: role, label });
  }

  try {
    let json;
    if (editId) {
      json = await api(`/api/chain-templates/${encodeURIComponent(editId)}`, {
        method: "PUT",
        body: JSON.stringify({ name, description, steps }),
      });
    } else {
      json = await api("/api/chain-templates", {
        method: "POST",
        body: JSON.stringify({ name, description, steps }),
      });
    }
    if (!json.success) { showToast(json.error || "Save failed", "error"); return; }
    showToast(editId ? "Template updated" : "Template created", "success");
    cancelTemplateForm();
    loadTemplates();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Save failed", "error");
  }
}

async function editTemplate(id) {
  try {
    const json = await api(`/api/chain-templates/${encodeURIComponent(id)}`);
    if (!json.success) { showToast("Failed to load template", "error"); return; }
    const t = json.data;
    const wrap = document.getElementById("template-form-wrap");
    document.getElementById("template-form-title").textContent = "Edit Template";
    document.getElementById("template-edit-id").value = t.id;
    document.getElementById("template-name").value = t.name;
    document.getElementById("template-description").value = t.description || "";
    templateStepCounter = 0;
    document.getElementById("template-steps-list").innerHTML = "";
    (t.steps || []).forEach(s => {
      addTemplateStep();
      const rows = document.getElementById("template-steps-list").children;
      const last = rows[rows.length - 1];
      last.querySelector(".step-role").value = s.requiredRole;
      last.querySelector(".step-label").value = s.label;
    });
    wrap.classList.remove("hidden");
    wrap.scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to load template", "error");
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
async function loadStats() {
  const loading = document.getElementById("dashboard-loading");
  if (loading) loading.classList.remove("hidden");
  try {
    const json = await api("/api/admin/stats");
    if (loading) loading.classList.add("hidden");
    if (!json.success) return;
    const d = json.data;

    document.getElementById("s-pending").textContent = d.pending;

    const totalDecided = d.dispatchSuccess + d.dispatchFailure;
    const rate = totalDecided > 0 ? ((d.dispatchSuccess / totalDecided) * 100).toFixed(1) + "%" : "—";
    document.getElementById("s-success-rate").textContent = rate;

    document.getElementById("s-retries").textContent = d.dispatchRetry;
    document.getElementById("s-avg-time").textContent = d.avgApprovalTimeSec > 0 ? fmtDuration(d.avgApprovalTimeSec) : "—";

    document.getElementById("s-created").textContent = d.approvalsCreated;
    document.getElementById("s-approved").textContent = d.approvalsApproved;
    document.getElementById("s-rejected").textContent = d.approvalsRejected;
    document.getElementById("s-expired").textContent = d.approvalsExpired;

    document.getElementById("s-d-success").textContent = d.dispatchSuccess;
    document.getElementById("s-d-failure").textContent = d.dispatchFailure;
    document.getElementById("s-d-latency").textContent = d.avgDispatchLatencySec > 0 ? fmtDuration(d.avgDispatchLatencySec) : "—";
    document.getElementById("s-chain-steps").textContent = d.activeChainSteps;

    // Update last-refreshed timestamp
    const ts = document.getElementById("dashboard-last-refreshed");
    if (ts) ts.textContent = "Last updated: " + new Date().toLocaleTimeString();
  } catch (e) {
    if (loading) loading.classList.add("hidden");
    if (e.message !== "Unauthorized") showToast("Failed to load stats", "error");
  }

  // Also load recent dispatches
  try {
    const json = await api("/api/approvals?status=dispatched&limit=20");
    if (!json.success) return;
    const dispatches = json.data.approvals;
    const tbody = document.getElementById("dispatch-body");
    const empty = document.getElementById("dispatch-empty");
    if (dispatches.length === 0) { tbody.innerHTML = ""; empty.classList.remove("hidden"); return; }
    empty.classList.add("hidden");
    tbody.innerHTML = dispatches.map(a =>
      `<tr>
        <td>${esc(a.action_intent || "—")}</td>
        <td><span class="status-badge dispatched">dispatched</span></td>
        <td>${esc(a.operator_id || "—")}</td>
        <td>${timeAgo(a.dispatched_at || a.updated_at)}</td>
      </tr>`
    ).join("");
  } catch (e) { /* ignore */ }
}

// ── Utilities ─────────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function fmtDuration(sec) {
  if (sec < 60) return sec.toFixed(1) + "s";
  if (sec < 3600) return (sec / 60).toFixed(1) + "m";
  return (sec / 3600).toFixed(1) + "h";
}

let toastTimer;
function showToast(msg, type) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + (type || "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

async function refresh() {
  const btn = document.getElementById("refresh-btn");
  btn.disabled = true;
  btn.textContent = "⟳ Loading…";
  try {
    const active = document.querySelector(".tab.active").dataset.tab;
    if (active === "queue") await loadApprovals();
    if (active === "dashboard") await loadStats();
    if (active === "chains") await loadTemplates();
    if (active === "prr") await loadPRRQueue();
    if (active === "members") { await loadMembers(); await loadUsage(); }
  } finally {
    btn.disabled = false;
    btn.textContent = "⟳ Refresh";
  }
}

// ── Workspace Members ─────────────────────────────────────────────────────
async function loadMembers() {
  try {
    const [membersRes, invitesRes] = await Promise.all([
      api("/api/workspace/members"),
      api("/api/workspace/invitations"),
    ]);

    if (membersRes.success) {
      renderMembers(membersRes.data);
    }
    if (invitesRes.success) {
      renderInvitations(invitesRes.data);
    }
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to load members", "error");
  }
}

function renderMembers(members) {
  const tbody = document.getElementById("members-body");
  const empty = document.getElementById("members-empty");
  
  if (!members || members.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  
  empty.classList.add("hidden");
  tbody.innerHTML = members.map(m => `
    <tr>
      <td>${esc(m.user_id)}</td>
      <td><span class="status-badge ${m.role}">${m.role}</span></td>
      <td>${timeAgo(m.joined_at)}</td>
      <td>${esc(m.invited_by || "—")}</td>
      <td>
        ${m.role !== "owner" ? `<button class="btn btn-sm btn-danger" onclick="removeMember('${m.user_id}')">Remove</button>` : ""}
      </td>
    </tr>
  `).join("");
}

function renderInvitations(invitations) {
  const tbody = document.getElementById("invitations-body");
  const empty = document.getElementById("invitations-empty");
  
  if (!invitations || invitations.length === 0) {
    tbody.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  
  empty.classList.add("hidden");
  tbody.innerHTML = invitations.map(inv => `
    <tr>
      <td>${esc(inv.email)}</td>
      <td><span class="status-badge ${inv.role}">${inv.role}</span></td>
      <td>${timeAgo(inv.created_at)}</td>
      <td>${new Date(inv.expires_at).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="copyInviteLink('${inv.token}')">Copy Link</button>
        <button class="btn btn-sm btn-danger" onclick="revokeInvite('${inv.id}')">Revoke</button>
      </td>
    </tr>
  `).join("");
}

function showInviteModal() {
  document.getElementById("invite-modal").classList.add("open");
  document.getElementById("invite-email").value = "";
  document.getElementById("invite-role").value = "member";
}

function closeInviteModal(e) {
  if (e && e.target !== document.getElementById("invite-modal")) return;
  document.getElementById("invite-modal").classList.remove("open");
}

async function sendInvite() {
  const email = document.getElementById("invite-email").value.trim();
  const role = document.getElementById("invite-role").value;
  
  if (!email) {
    showToast("Email is required", "error");
    return;
  }
  
  try {
    const json = await api("/api/workspace/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    
    if (!json.success) {
      showToast(json.error || "Failed to send invitation", "error");
      return;
    }
    
    showToast(`Invitation sent to ${email}`, "success");
    closeInviteModal();
    loadMembers();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to send invitation", "error");
  }
}

// ── Inline Invite Form ───────────────────────────────────────────────────
function toggleInviteForm() {
  const wrap = document.getElementById("invite-form-wrap");
  if (wrap.classList.contains("hidden")) {
    document.getElementById("invite-form-email").value = "";
    document.getElementById("invite-form-role").value = "admin";
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

function cancelInviteForm() {
  document.getElementById("invite-form-wrap").classList.add("hidden");
}

async function submitInviteForm() {
  const email = document.getElementById("invite-form-email").value.trim();
  const role = document.getElementById("invite-form-role").value;
  if (!email) { showToast("Email is required", "error"); return; }
  if (!email.includes("@")) { showToast("Please enter a valid email address", "error"); return; }

  try {
    const json = await api("/api/workspace/invite", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
    if (!json.success) { showToast(json.error || "Failed to send invitation", "error"); return; }
    showToast("Invitation sent", "success");
    cancelInviteForm();
    loadMembers();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to send invitation", "error");
  }
}

async function removeMember(userId) {
  if (!confirm(`Remove user ${userId} from workspace?`)) return;
  
  try {
    const json = await api(`/api/workspace/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
    
    if (!json.success) {
      showToast(json.error || "Failed to remove member", "error");
      return;
    }
    
    showToast("Member removed", "success");
    loadMembers();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to remove member", "error");
  }
}

async function revokeInvite(inviteId) {
  if (!confirm("Revoke this invitation?")) return;
  
  try {
    const json = await api(`/api/workspace/invitations/${encodeURIComponent(inviteId)}`, {
      method: "DELETE",
    });
    
    if (!json.success) {
      showToast(json.error || "Failed to revoke invitation", "error");
      return;
    }
    
    showToast("Invitation revoked", "success");
    loadMembers();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to revoke invitation", "error");
  }
}

function copyInviteLink(token) {
  const link = `${window.location.origin}/pj/invite/${token}`;
  navigator.clipboard.writeText(link).then(() => {
    showToast("Invitation link copied to clipboard", "success");
  }).catch(() => {
    showToast("Failed to copy link", "error");
  });
}

// ── Workspace Usage & Upgrade ─────────────────────────────────────────────
async function fetchWorkspaceUsage() {
  try {
    const json = await api("/api/workspace/usage");
    if (json.success) {
      return json.data;
    }
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to load usage data", "error");
  }
  return null;
}

function renderUsageCard(usage) {
  if (!usage) return;
  
  const planBadge = document.getElementById("plan-badge");
  planBadge.textContent = usage.plan.toUpperCase();
  planBadge.className = `plan-badge plan-${usage.plan}`;
  
  const metricsDiv = document.getElementById("usage-metrics");
  const resources = [
    { key: "templates", label: "Templates" },
    { key: "approvals", label: "Approvals" },
    { key: "members", label: "Members" }
  ];
  
  metricsDiv.innerHTML = resources.map(({ key, label }) => {
    const current = usage.usage[key];
    const limit = usage.limits[key];
    const percent = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    const isAtLimit = current >= limit;
    const isNearLimit = percent >= 85;
    
    let statusClass = "";
    let statusLabel = "";
    if (isAtLimit) {
      statusClass = "at-limit";
      statusLabel = '<span class="limit-badge">LIMIT REACHED</span>';
    } else if (isNearLimit) {
      statusClass = "near-limit";
      statusLabel = '<span class="limit-badge warn">NEAR LIMIT</span>';
    }
    
    return `
      <div class="usage-item">
        <div class="usage-label">
          <strong>${esc(label)}</strong>
          ${statusLabel}
        </div>
        <div class="usage-bar-wrap">
          <div class="usage-bar ${statusClass}" style="width:${percent}%"></div>
        </div>
        <div class="usage-count">${current} / ${limit === 999999 ? '∞' : limit}</div>
      </div>
    `;
  }).join("");
  
  // Show/hide upgrade button based on limits
  const upgradeBtn = document.getElementById("upgrade-btn");
  if (usage.plan === "free") {
    upgradeBtn.classList.remove("hidden");
  } else {
    upgradeBtn.classList.add("hidden");
  }
}

async function loadUsage() {
  const usage = await fetchWorkspaceUsage();
  if (usage) {
    renderUsageCard(usage);
  }
}

function openUpgradeModal() {
  const modal = document.getElementById("upgrade-modal");
  const currentPlanDisplay = document.getElementById("current-plan-display");
  const planBadge = document.getElementById("plan-badge");
  currentPlanDisplay.textContent = planBadge.textContent;
  currentPlanDisplay.className = planBadge.className;
  modal.classList.add("open");
}

function closeUpgradeModal(event) {
  if (event && event.target !== document.getElementById("upgrade-modal")) return;
  document.getElementById("upgrade-modal").classList.remove("open");
}

async function submitPlanChange() {
  const selectedPlan = document.querySelector('input[name="plan-choice"]:checked').value;
  
  try {
    // Get current workspace ID from /api/me
    const meRes = await fetch("/api/me", { headers: authHeaders() });
    if (!meRes.ok) {
      showToast("Failed to get workspace info", "error");
      return;
    }
    const me = await meRes.json();
    const workspaceId = me.workspaceId;
    
    const json = await api(`/api/admin/workspace/${encodeURIComponent(workspaceId)}/plan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selectedPlan })
    });
    
    if (!json.success) {
      const errorMsg = json.error === "Admin only" 
        ? "Admin privileges required to change plan"
        : json.error || "Failed to update plan";
      showToast(errorMsg, "error");
      return;
    }
    
    showToast(`Workspace plan updated to ${selectedPlan.toUpperCase()}. New limits applied.`, "success");
    closeUpgradeModal();
    await loadUsage();
    
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to update plan", "error");
  }
}

// ── PRR Management ────────────────────────────────────────────────────────
function togglePRRForm() {
  const wrap = document.getElementById("prr-form-wrap");
  if (wrap.classList.contains("hidden")) {
    document.getElementById("prr-form-name").value = "";
    document.getElementById("prr-form-description").value = "";
    document.getElementById("prr-form-due").value = "";
    wrap.classList.remove("hidden");
  } else {
    wrap.classList.add("hidden");
  }
}

function cancelPRRForm() {
  document.getElementById("prr-form-wrap").classList.add("hidden");
}

async function submitPRRForm() {
  const requesterName = document.getElementById("prr-form-name").value.trim();
  const description = document.getElementById("prr-form-description").value.trim();
  const dueDate = document.getElementById("prr-form-due").value;
  if (!requesterName) { showToast("Requester name is required", "error"); return; }
  if (!description) { showToast("Description is required", "error"); return; }

  try {
    const body = { requesterName, description };
    if (dueDate) body.dueDate = dueDate;
    const json = await api("/api/prr", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!json.success) { showToast(json.error || "Failed to create request", "error"); return; }
    showToast("Request created", "success");
    cancelPRRForm();
    loadPRRQueue();
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to create request", "error");
  }
}

async function loadPRRQueue() {
  const statusFilter = document.getElementById('prr-status-filter')?.value || '';
  const params = new URLSearchParams();
  if (statusFilter) params.append('status', statusFilter);
  const loading = document.getElementById("prr-loading");
  if (loading) loading.classList.remove("hidden");
  
  try {
    const json = await api(`/api/prr?${params}`);
    if (loading) loading.classList.add("hidden");
    if (json.success) {
      renderPRRQueue(json.data.requests);
    }
  } catch (e) {
    if (loading) loading.classList.add("hidden");
    if (e.message !== "Unauthorized") showToast("Failed to load PRRs", "error");
  }
}

function renderPRRQueue(requests) {
  const tbody = document.getElementById('prr-queue-body');
  const empty = document.getElementById('prr-queue-empty');
  
  if (!requests || requests.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove("hidden");
    return;
  }
  
  empty.classList.add("hidden");
  tbody.innerHTML = requests.map(prr => {
    const statusClass = prr.status.replace('_', '-');
    return `
      <tr>
        <td><code>${esc(prr.id.substring(0, 8))}</code></td>
        <td>${esc(prr.submitter_name || 'Anonymous')}<br><small>${esc(prr.submitter_email || '—')}</small></td>
        <td>${esc(prr.summary)}</td>
        <td><span class="status-badge prr-${statusClass}">${esc(prr.status.replace('_', ' '))}</span></td>
        <td>${esc(prr.assigned_to || '—')}</td>
        <td>${timeAgo(prr.created_at)}</td>
        <td><button class="btn-link" onclick="openPRRDetail('${prr.id}')">View</button></td>
      </tr>
    `;
  }).join('');
}

async function openPRRDetail(id) {
  try {
    const json = await api(`/api/prr/${encodeURIComponent(id)}`);
    if (json.success) {
      renderPRRDetail(json.data);
      document.getElementById('prr-detail-overlay').classList.add('open');
    }
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to load PRR", "error");
  }
}

function renderPRRDetail(prr) {
  const attachments = prr.attachments || [];
  
  const content = document.getElementById('prr-detail-content');
  content.innerHTML = `
    <div class="detail-field">
      <label>Status</label>
      <select id="prr-status-select" onchange="updatePRRStatus('${prr.id}')">
        <option value="submitted" ${prr.status === 'submitted' ? 'selected' : ''}>Submitted</option>
        <option value="acknowledged" ${prr.status === 'acknowledged' ? 'selected' : ''}>Acknowledged</option>
        <option value="in_progress" ${prr.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
        <option value="closed" ${prr.status === 'closed' ? 'selected' : ''}>Closed</option>
      </select>
    </div>
    
    <div class="detail-field">
      <label>Submitter</label>
      <div>${esc(prr.submitter_name || 'Anonymous')}</div>
      <div><small>${esc(prr.submitter_email || '—')}</small></div>
    </div>
    
    <div class="detail-field">
      <label>Summary</label>
      <div>${esc(prr.summary)}</div>
    </div>
    
    <div class="detail-field">
      <label>Details</label>
      <div>${esc(prr.details || 'No additional details')}</div>
    </div>
    
    <div class="detail-field">
      <label>Created</label>
      <div>${timeAgo(prr.created_at)}</div>
    </div>
    
    ${attachments.length > 0 ? `
      <div class="detail-field">
        <label>Attachments</label>
        ${attachments.map(att => `<div><a href="/api/prr/${prr.id}/attachment/${att.filename}">${esc(att.filename)}</a></div>`).join('')}
      </div>
    ` : ''}
    
    <div class="detail-field detail-field-mt">
      <label>Comments</label>
      <div id="prr-comments-list">
        ${(prr.comments || []).map(c => `
          <div class="prr-comment">
            <div class="prr-comment-meta">${timeAgo(c.created_at)} • ${c.user_id ? 'Admin' : 'System'}</div>
            <div>${esc(c.body)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="prr-comment-form">
        <textarea id="prr-comment-input" placeholder="Add a comment..." class="prr-comment-input"></textarea>
        <button class="btn btn-primary btn-mt" onclick="addPRRComment('${prr.id}')">Add Comment</button>
      </div>
    </div>
  `;
}

async function updatePRRStatus(id) {
  const status = document.getElementById('prr-status-select').value;
  
  try {
    const json = await api(`/api/prr/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    
    if (json.success) {
      showToast('Status updated', 'success');
      loadPRRQueue();
    }
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to update status", "error");
  }
}

async function addPRRComment(id) {
  const input = document.getElementById('prr-comment-input');
  const body = input.value.trim();
  
  if (!body) return;
  
  try {
    const json = await api(`/api/prr/${encodeURIComponent(id)}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body })
    });
    
    if (json.success) {
      showToast('Comment added', 'success');
      input.value = '';
      openPRRDetail(id); // Refresh detail
    }
  } catch (e) {
    if (e.message !== "Unauthorized") showToast("Failed to add comment", "error");
  }
}

function closePRRDetail(event) {
  if (event && event.target !== document.getElementById('prr-detail-overlay')) return;
  document.getElementById('prr-detail-overlay').classList.remove('open');
}

// ── Auto-refresh ──────────────────────────────────────────────────────────
let autoRefreshApprovalTimer = null;
let autoRefreshDashboardTimer = null;
let autoRefreshPRRTimer = null;

function startAutoRefresh() {
  stopAutoRefresh();
  const indicator = document.getElementById("auto-refresh-indicator");
  if (indicator) indicator.classList.remove("hidden");

  autoRefreshApprovalTimer = setInterval(() => {
    const active = document.querySelector(".tab.active");
    if (active && active.dataset.tab === "queue") loadApprovals();
  }, 30000);

  autoRefreshDashboardTimer = setInterval(() => {
    const active = document.querySelector(".tab.active");
    if (active && active.dataset.tab === "dashboard") loadStats();
  }, 60000);

  autoRefreshPRRTimer = setInterval(() => {
    const active = document.querySelector(".tab.active");
    if (active && active.dataset.tab === "prr") loadPRRQueue();
  }, 30000);
}

function stopAutoRefresh() {
  if (autoRefreshApprovalTimer) { clearInterval(autoRefreshApprovalTimer); autoRefreshApprovalTimer = null; }
  if (autoRefreshDashboardTimer) { clearInterval(autoRefreshDashboardTimer); autoRefreshDashboardTimer = null; }
  if (autoRefreshPRRTimer) { clearInterval(autoRefreshPRRTimer); autoRefreshPRRTimer = null; }
  const indicator = document.getElementById("auto-refresh-indicator");
  if (indicator) indicator.classList.add("hidden");
}

// ── Hash navigation ──────────────────────────────────────────────────────
window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace("#", "");
  const tab = HASH_TAB_MAP[hash];
  if (tab) switchTab(tab);
});

// ── Init ──────────────────────────────────────────────────────────────────
// Fetch user role and workspace before loading data
(async function init() {
  try {
    const meRes = await fetch("/api/me", { headers: authHeaders() });
    if (meRes.ok) {
      const me = await meRes.json();
      userRole = me.role;
      if (me.workspaceName) {
        const ws = document.getElementById("workspace-name");
        ws.textContent = me.workspaceName;
        ws.classList.remove("hidden");
      }
    }
  } catch { /* ignore */ }

  // Restore tab from URL hash
  const hash = window.location.hash.replace("#", "");
  const tab = HASH_TAB_MAP[hash];
  if (tab) {
    switchTab(tab);
  } else {
    loadApprovals();
  }

  // Start auto-refresh timers
  startAutoRefresh();
})();
