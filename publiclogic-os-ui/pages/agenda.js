import { el } from "../lib/dom.js";
import { button, pill, showModal } from "../lib/ui.js";
import { endOfWeekSunday, startOfWeekMonday, toIsoDate } from "../lib/time.js";

const KINDS = ["Action", "Decision", "Risk", "Project", "Note"];
const RISK_LEVELS = ["Low", "Med", "High"];

function normalizeText(v) {
  return String(v || "").trim();
}

function normalizeKind(v) {
  const k = normalizeText(v);
  if (!k) return "Note";
  const hit = KINDS.find((x) => x.toLowerCase() === k.toLowerCase());
  return hit || k;
}

function toDateValue(v) {
  const s = normalizeText(v);
  if (!s) return "";
  return s.slice(0, 10);
}

function parseDate(v) {
  const s = normalizeText(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.valueOf())) return null;
  return d;
}

function isTruthy(v) {
  if (typeof v === "boolean") return v;
  const s = normalizeText(v).toLowerCase();
  return ["true", "1", "yes", "y"].includes(s);
}

function ownerLabel(cfg, ownerValue) {
  const v = normalizeText(ownerValue);
  if (!v) return "";
  const match = (cfg.team?.people || []).find((p) => p.email === v || p.name === v);
  return match?.name || v;
}

function kindPill(kind) {
  const k = normalizeKind(kind);
  if (k.toLowerCase() === "action") return pill("Action", "mint");
  if (k.toLowerCase() === "decision") return pill("Decision", "gold");
  if (k.toLowerCase() === "risk") return pill("Risk", "rose");
  if (k.toLowerCase() === "project") return pill("Project", "mint");
  return pill(k, "");
}

function statusPill(status) {
  const s = normalizeText(status);
  const k = s.toLowerCase();
  if (k === "done" || k === "complete" || k === "closed") return pill(s || "Done", "mint");
  if (k === "blocked") return pill(s || "Blocked", "rose");
  if (k === "in progress" || k === "active" || k === "mitigating") return pill(s || "In Progress", "gold");
  if (k === "open" || k === "watching") return pill(s || "Open", "gold");
  return pill(s || "—", "");
}

function inRange(d, start, end) {
  if (!d) return false;
  return d.valueOf() >= start.valueOf() && d.valueOf() <= end.valueOf();
}

function safeJoin(bits) {
  return bits.map((b) => normalizeText(b)).filter(Boolean).join(" | ");
}

function buildPublicMarkdown({ townLabel, weekStart, weekEnd, items }) {
  const lines = [];
  lines.push(`# ${townLabel} — Living Agenda (PublicLogic™)`);
  lines.push("");
  lines.push(`**This Week (${toIsoDate(weekStart)} to ${toIsoDate(weekEnd)})**`);
  lines.push("");

  const publicItems = items.filter((it) => isTruthy(it.IsPublic));
  const actions = publicItems
    .filter((it) => normalizeKind(it.Kind).toLowerCase() === "action")
    .filter((it) => {
      const due = parseDate(it.DueDate);
      if (!due) return false;
      const s = normalizeText(it.Status).toLowerCase();
      if (["done", "complete", "closed"].includes(s)) return false;
      return inRange(due, weekStart, weekEnd);
    })
    .slice()
    .sort((a, b) => String(a.DueDate || "").localeCompare(String(b.DueDate || "")));

  if (actions.length === 0) {
    lines.push(`- (No public action items posted)`);
  } else {
    for (const a of actions.slice(0, 12)) {
      const due = toDateValue(a.DueDate);
      const status = normalizeText(a.Status);
      const details = normalizeText(a.PublicDetails) || normalizeText(a.PublicSummary);
      const tail = safeJoin([status, due]);
      lines.push(`- ${normalizeText(a.Title) || "(untitled)"}${tail ? ` — ${tail}` : ""}`);
      if (details) lines.push(`  - ${details}`);
    }
  }

  const decisions = publicItems
    .filter((it) => normalizeKind(it.Kind).toLowerCase() === "decision")
    .slice()
    .sort((a, b) => String(b.DueDate || "").localeCompare(String(a.DueDate || "")));

  lines.push("");
  lines.push(`**Decision Log (Public)**`);
  lines.push("");

  if (decisions.length === 0) {
    lines.push(`- (No public decisions posted)`);
  } else {
    for (const d of decisions.slice(0, 12)) {
      const date = toDateValue(d.DueDate);
      const topic = normalizeText(d.Title) || "(untitled)";
      const decision = normalizeText(d.PublicDetails) || normalizeText(d.PublicSummary);
      lines.push(`- ${topic}${date ? ` — ${date}` : ""}`);
      if (decision) lines.push(`  - ${decision}`);
    }
  }

  lines.push("");
  lines.push(`_Public view notes: This page is a working agenda. Sensitive details are intentionally omitted._`);
  return lines.join("\n");
}

function openEditModal({ cfg, sp, listName, item, onSaved }) {
  const kind = el("select", { class: "select" }, KINDS.map((k) => el("option", { value: k, ...(normalizeKind(item.Kind) === k ? { selected: "selected" } : {}) }, [k])));
  const workspace = el("input", { class: "input", value: item.Workspace || "" });
  const title = el("input", { class: "input", value: item.Title || "" });
  const owner = el("input", { class: "input", value: item.Owner || "" });
  const due = el("input", { class: "input", type: "date", value: toDateValue(item.DueDate) });
  const status = el("input", { class: "input", value: item.Status || "" });
  const dod = el("textarea", { class: "textarea" }, [item.DoD || ""]);
  const details = el("textarea", { class: "textarea" }, [item.Details || ""]);

  const isPublic = el("input", { type: "checkbox", ...(isTruthy(item.IsPublic) ? { checked: "checked" } : {}) });
  const publicDetails = el("textarea", { class: "textarea" }, [item.PublicDetails || item.PublicSummary || ""]);

  const oml = el("input", { type: "checkbox", ...(isTruthy(item.OML) ? { checked: "checked" } : {}) });
  const prr = el("input", { type: "checkbox", ...(isTruthy(item.PRR) ? { checked: "checked" } : {}) });
  const retention = el("input", { class: "input", value: item.RetentionTag || "" });
  const impacted = el("input", { class: "input", value: item.ImpactedDepts || "" });

  const likelihood = el("select", { class: "select" }, [el("option", { value: "" }, ["—"]), ...RISK_LEVELS.map((l) => el("option", { value: l, ...(normalizeText(item.Likelihood) === l ? { selected: "selected" } : {}) }, [l]))]);
  const impact = el("select", { class: "select" }, [el("option", { value: "" }, ["—"]), ...RISK_LEVELS.map((l) => el("option", { value: l, ...(normalizeText(item.Impact) === l ? { selected: "selected" } : {}) }, [l]))]);
  const mitigation = el("textarea", { class: "textarea" }, [item.Mitigation || ""]);

  const module = el("input", { class: "input", value: item.Module || "" });
  const funding = el("input", { class: "input", value: item.Funding || "" });
  const compliance = el("input", { class: "input", value: item.Compliance || "" });
  const links = el("input", { class: "input", value: item.Links || "" });

  const body = el("div", { class: "form" }, [
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Kind"]), kind]),
      el("div", {}, [el("div", { class: "label" }, ["Workspace"]), workspace])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Title"]), title]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Owner"]), owner]),
      el("div", {}, [el("div", { class: "label" }, ["Status"]), status])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Date / Due / Target"]), due]),
    el("div", {}, [el("div", { class: "label" }, ["Definition of Done (DoD)"]), dod]),
    el("div", {}, [el("div", { class: "label" }, ["Details (Internal)"]), details]),
    el("div", { class: "split" }, [
      el("div", {}, [
        el("div", { class: "label" }, ["Public"]),
        el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [
          isPublic,
          el("span", {}, ["Visible in Public View"])
        ])
      ]),
      el("div", {}, [el("div", { class: "label" }, ["Public Summary (Safe)"]), publicDetails])
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "small" }, ["Compliance / governance (optional):"]),
    el("div", { class: "split" }, [
      el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [oml, el("span", {}, ["OML (M.G.L. c.30A) flagged"])]),
      el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [prr, el("span", {}, ["PRR (M.G.L. c.66 §10) flagged"])])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["RetentionTag"]), retention]),
      el("div", {}, [el("div", { class: "label" }, ["ImpactedDepts"]), impacted])
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "small" }, ["Risk fields (optional):"]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Likelihood"]), likelihood]),
      el("div", {}, [el("div", { class: "label" }, ["Impact"]), impact])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Mitigation"]), mitigation]),
    el("div", { class: "hr" }),
    el("div", { class: "small" }, ["Project fields (optional):"]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Module"]), module]),
      el("div", {}, [el("div", { class: "label" }, ["Funding"]), funding])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Compliance"]), compliance]),
      el("div", {}, [el("div", { class: "label" }, ["Links"]), links])
    ])
  ]);

  const modal = showModal({
    title: "Edit Intake Item",
    body,
    actions: [
      {
        label: "Save",
        variant: "primary",
        onClick: async () => {
          const fields = {
            Title: normalizeText(title.value),
            Kind: normalizeText(kind.value),
            Workspace: normalizeText(workspace.value),
            Owner: normalizeText(owner.value),
            DueDate: due.value || null,
            Status: normalizeText(status.value),
            DoD: normalizeText(dod.value),
            Details: normalizeText(details.value),
            IsPublic: Boolean(isPublic.checked),
            PublicDetails: normalizeText(publicDetails.value),
            OML: Boolean(oml.checked),
            PRR: Boolean(prr.checked),
            RetentionTag: normalizeText(retention.value),
            ImpactedDepts: normalizeText(impacted.value),
            Likelihood: normalizeText(likelihood.value),
            Impact: normalizeText(impact.value),
            Mitigation: normalizeText(mitigation.value),
            Module: normalizeText(module.value),
            Funding: normalizeText(funding.value),
            Compliance: normalizeText(compliance.value),
            Links: normalizeText(links.value)
          };

          if (!fields.Title) {
            title.focus();
            return;
          }

          await sp.updateItemFields(listName, item.itemId, fields);
          modal.close();
          onSaved();
        }
      }
    ]
  });
}

export async function renderAgenda(ctx) {
  const { cfg, sp } = ctx;

  const listName = cfg.sharepoint?.lists?.agenda;
  const defaultWorkspace = normalizeText(cfg.agenda?.defaultWorkspace) || "Logicville, MA";
  const townLabel = defaultWorkspace || "Logicville, MA";

  let items = [];
  let loadError = null;

  async function load() {
    loadError = null;
    items = [];
    if (!listName) return;

    try {
      items = await sp.listItems(listName);
    } catch (e) {
      loadError = e;
    }
  }

  await load();

  const state = {
    view: "internal",
    workspace: defaultWorkspace,
    kind: "all"
  };

  const viewSelect = el("select", { class: "select" }, [
    el("option", { value: "internal" }, ["Internal view"]),
    el("option", { value: "public" }, ["Public view (safe)"])
  ]);

  const workspaceSelect = el("select", { class: "select" });
  const kindSelect = el("select", { class: "select" }, [
    el("option", { value: "all" }, ["All kinds"]),
    ...KINDS.map((k) => el("option", { value: k.toLowerCase() }, [k]))
  ]);

  viewSelect.addEventListener("change", () => {
    state.view = viewSelect.value;
    rerender();
  });

  workspaceSelect.addEventListener("change", () => {
    state.workspace = workspaceSelect.value;
    rerender();
  });

  kindSelect.addEventListener("change", () => {
    state.kind = kindSelect.value;
    rerender();
  });

  const intakeKind = el("select", { class: "select" }, KINDS.map((k) => el("option", { value: k }, [k])));
  const intakeWorkspace = el("input", { class: "input", value: defaultWorkspace });
  const intakeTitle = el("input", { class: "input", placeholder: "Short, plain-language title" });
  const intakeOwner = el("select", { class: "select" }, [
    el("option", { value: "" }, ["—"]),
    ...((cfg.team?.people || []).map((p) => el("option", { value: p.name }, [p.name]))),
    el("option", { value: "Both" }, ["Both"])
  ]);
  const intakeStatus = el("input", { class: "input", placeholder: "Not Started / In Progress / Blocked / Done (or similar)" });
  const intakeDue = el("input", { class: "input", type: "date" });
  const intakeDoD = el("textarea", { class: "textarea", placeholder: "Definition of Done (objective and testable)" });
  const intakeDetails = el("textarea", { class: "textarea", placeholder: "Internal notes (no PII). Link to source systems." });

  const intakeIsPublic = el("input", { type: "checkbox" });
  const intakePublicDetails = el("textarea", { class: "textarea", placeholder: "Public-safe summary (what can be shared externally)" });

  const intakeOml = el("input", { type: "checkbox" });
  const intakePrr = el("input", { type: "checkbox" });
  const intakeRetention = el("input", { class: "input", placeholder: "Retention tag (if applicable)" });
  const intakeImpacted = el("input", { class: "input", placeholder: "Impacted departments (if applicable)" });

  const intakeLikelihood = el("select", { class: "select" }, [
    el("option", { value: "" }, ["—"]),
    ...RISK_LEVELS.map((l) => el("option", { value: l }, [l]))
  ]);
  const intakeImpact = el("select", { class: "select" }, [
    el("option", { value: "" }, ["—"]),
    ...RISK_LEVELS.map((l) => el("option", { value: l }, [l]))
  ]);
  const intakeMitigation = el("textarea", { class: "textarea", placeholder: "Mitigation plan (if risk)" });

  const intakeModule = el("input", { class: "input", placeholder: "Module (e.g., CLERK, FIX, AGENDA)" });
  const intakeFunding = el("input", { class: "input", placeholder: "Funding / grant (if applicable)" });
  const intakeCompliance = el("input", { class: "input", placeholder: "Compliance checkpoints (if applicable)" });
  const intakeLinks = el("input", { class: "input", placeholder: "Links (SharePoint, specs, docs)" });

  function setIntakeLabels() {
    const k = normalizeKind(intakeKind.value).toLowerCase();
    if (k === "decision") {
      intakeDue.previousSibling.textContent = "Date";
      return;
    }
    if (k === "project") {
      intakeDue.previousSibling.textContent = "Target";
      return;
    }
    intakeDue.previousSibling.textContent = "Due";
  }

  intakeKind.addEventListener("change", () => setIntakeLabels());

  async function createItem() {
    if (!listName) return;

    const fields = {
      Title: normalizeText(intakeTitle.value),
      Kind: normalizeText(intakeKind.value),
      Workspace: normalizeText(intakeWorkspace.value) || defaultWorkspace,
      Owner: normalizeText(intakeOwner.value),
      Status: normalizeText(intakeStatus.value),
      DueDate: intakeDue.value || null,
      DoD: normalizeText(intakeDoD.value),
      Details: normalizeText(intakeDetails.value),
      IsPublic: Boolean(intakeIsPublic.checked),
      PublicDetails: normalizeText(intakePublicDetails.value),
      OML: Boolean(intakeOml.checked),
      PRR: Boolean(intakePrr.checked),
      RetentionTag: normalizeText(intakeRetention.value),
      ImpactedDepts: normalizeText(intakeImpacted.value),
      Likelihood: normalizeText(intakeLikelihood.value),
      Impact: normalizeText(intakeImpact.value),
      Mitigation: normalizeText(intakeMitigation.value),
      Module: normalizeText(intakeModule.value),
      Funding: normalizeText(intakeFunding.value),
      Compliance: normalizeText(intakeCompliance.value),
      Links: normalizeText(intakeLinks.value)
    };

    if (!fields.Title) {
      intakeTitle.focus();
      return;
    }

    try {
      await sp.createItem(listName, fields);
      intakeTitle.value = "";
      intakeStatus.value = "";
      intakeDue.value = "";
      intakeDoD.value = "";
      intakeDetails.value = "";
      intakeIsPublic.checked = false;
      intakePublicDetails.value = "";
      intakeOml.checked = false;
      intakePrr.checked = false;
      intakeRetention.value = "";
      intakeImpacted.value = "";
      intakeLikelihood.value = "";
      intakeImpact.value = "";
      intakeMitigation.value = "";
      intakeModule.value = "";
      intakeFunding.value = "";
      intakeCompliance.value = "";
      intakeLinks.value = "";

      await load();
      rerender();
    } catch (e) {
      showModal({
        title: "Create failed",
        body: el("div", { class: "error", style: "white-space: pre-wrap;" }, [
          String(e.message || e),
          "\n\nIf this is a new list, confirm the columns exist with the exact names in SETUP.md (Agenda Intake section)."
        ])
      });
    }
  }

  const execSummary = el("div", { class: "card", style: "grid-column: span 12;" }, [
    el("h3", {}, [`${townLabel} — Executive Summary`]),
    el("div", { class: "small" }, [
      "One running workspace for decisions, priorities, and handoffs. Weekly sync (30–45 min) plus optional 90‑minute founders block. ",
      "Every task uses Owner • Due (YYYY‑MM‑DD) • DoD. OML/PRR flagged where needed. Public artifacts are WCAG 2.1 AA checked."
    ])
  ]);

  const controlsCard = el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, ["View Controls"]),
    el("div", { class: "form" }, [
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["View"]), viewSelect]),
        el("div", {}, [el("div", { class: "label" }, ["Workspace"]), workspaceSelect])
      ]),
      el("div", {}, [el("div", { class: "label" }, ["Kind"]), kindSelect]),
      el("div", { class: "hr" }),
      el("div", { class: "small" }, [
        "Public view is a safe export mode (no internal notes). It does not make this portal public."
      ])
    ])
  ]);

  const intakeCard = el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, ["Singular Intake"]),
    ...(listName
      ? []
      : [el("div", { class: "notice" }, [
          "Config missing: sharepoint.lists.agenda. Add an Agenda list in config.js, create the list + columns in SharePoint, then reload."
        ])]),
    el("div", { class: "form" }, [
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["Kind"]), intakeKind]),
        el("div", {}, [el("div", { class: "label" }, ["Workspace"]), intakeWorkspace])
      ]),
      el("div", {}, [el("div", { class: "label" }, ["Title"]), intakeTitle]),
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["Owner"]), intakeOwner]),
        el("div", {}, [el("div", { class: "label" }, ["Status"]), intakeStatus])
      ]),
      el("div", {}, [el("div", { class: "label" }, ["Due"]), intakeDue]),
      el("div", {}, [el("div", { class: "label" }, ["DoD"]), intakeDoD]),
      el("div", {}, [el("div", { class: "label" }, ["Details (Internal)"]), intakeDetails]),
      el("div", { class: "split" }, [
        el("div", {}, [
          el("div", { class: "label" }, ["Public Toggle"]),
          el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [
            intakeIsPublic,
            el("span", {}, ["Include in Public View"])
          ])
        ]),
        el("div", {}, [el("div", { class: "label" }, ["Public Summary (Safe)"]), intakePublicDetails])
      ]),
      el("div", { class: "hr" }),
      el("div", { class: "split" }, [
        el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [intakeOml, el("span", {}, ["OML flagged (M.G.L. c.30A)"])]),
        el("label", { class: "small", style: "display:flex; align-items:center; gap:10px;" }, [intakePrr, el("span", {}, ["PRR flagged (M.G.L. c.66 §10)"])])
      ]),
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["RetentionTag"]), intakeRetention]),
        el("div", {}, [el("div", { class: "label" }, ["ImpactedDepts"]), intakeImpacted])
      ]),
      el("div", { class: "hr" }),
      el("div", { class: "small" }, ["Risk fields (optional):"]),
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["Likelihood"]), intakeLikelihood]),
        el("div", {}, [el("div", { class: "label" }, ["Impact"]), intakeImpact])
      ]),
      el("div", {}, [el("div", { class: "label" }, ["Mitigation"]), intakeMitigation]),
      el("div", { class: "hr" }),
      el("div", { class: "small" }, ["Project fields (optional):"]),
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["Module"]), intakeModule]),
        el("div", {}, [el("div", { class: "label" }, ["Funding"]), intakeFunding])
      ]),
      el("div", { class: "split" }, [
        el("div", {}, [el("div", { class: "label" }, ["Compliance"]), intakeCompliance]),
        el("div", {}, [el("div", { class: "label" }, ["Links"]), intakeLinks])
      ]),
      el("div", { class: "chiprow" }, [
        button("Create Item", { variant: "primary", onClick: () => createItem(), title: "Creates a new item in the Agenda list" })
      ]),
      el("div", { class: "small" }, [
        "Guardrails: no PII in this portal. Link to source systems. If it's not actionable (Owner + Date + DoD), do not log it."
      ])
    ])
  ]);

  const thisWeekCard = el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, ["This Week (Mon–Sun)"]),
    el("div", { class: "small" }, ["—"])
  ]);

  const next10Card = el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, ["Next 10 Days"]),
    el("div", { class: "small" }, ["—"])
  ]);

  const redFlagsCard = el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, ["Red Flags / Watch List"]),
    el("div", { class: "small" }, ["—"])
  ]);

  const registersCard = el("div", { class: "card", style: "grid-column: span 12;" }, [
    el("h3", {}, ["Registers"]),
    el("div", {}, ["—"])
  ]);

  function filteredItems() {
    const wantWorkspace = normalizeText(state.workspace);
    const wantKind = normalizeText(state.kind);

    return items.filter((it) => {
      if (state.view === "public" && !isTruthy(it.IsPublic)) return false;

      if (wantWorkspace && wantWorkspace.toLowerCase() !== "all") {
        const ws = normalizeText(it.Workspace);
        if (ws.toLowerCase() !== wantWorkspace.toLowerCase()) return false;
      }

      if (wantKind && wantKind !== "all") {
        const k = normalizeKind(it.Kind).toLowerCase();
        if (k !== wantKind) return false;
      }

      return true;
    });
  }

  function renderListLines(cardEl, lines) {
    cardEl.innerHTML = "";
    if (lines.length === 0) {
      cardEl.appendChild(el("div", { class: "notice" }, ["Nothing queued yet."]));
      return;
    }
    const wrap = el("div", {});
    for (const line of lines) wrap.appendChild(el("div", { class: "small", style: "padding: 6px 0; border-bottom: 1px solid var(--line);" }, [line]));
    cardEl.appendChild(wrap);
  }

  function renderTable({ title, rows, columns, emptyText }) {
    const wrap = el("div", { style: "margin-top: 12px;" }, [
      el("div", { class: "small", style: "font-weight: 800; color: rgba(247,245,239,0.86); margin-bottom: 8px;" }, [title])
    ]);

    if (rows.length === 0) {
      wrap.appendChild(el("div", { class: "notice" }, [emptyText || "No items yet."]));
      return wrap;
    }

    const table = el("table", { class: "table" });
    table.appendChild(el("thead", {}, [
      el("tr", {}, columns.map((c) => el("th", {}, [c.label])))
    ]));

    const tbody = el("tbody");
    for (const r of rows) {
      const tr = el("tr");
      for (const c of columns) {
        const cell = c.render(r);
        tr.appendChild(el("td", { class: c.muted ? "row-muted" : "" }, Array.isArray(cell) ? cell : [cell]));
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function rerender() {
    const weekStart = startOfWeekMonday(new Date());
    const weekEnd = endOfWeekSunday(new Date());
    const tenDays = new Date();
    tenDays.setDate(tenDays.getDate() + 10);
    tenDays.setHours(23, 59, 59, 999);

    // workspace options
    const workspaces = new Set([defaultWorkspace]);
    for (const it of items) {
      const ws = normalizeText(it.Workspace);
      if (ws) workspaces.add(ws);
    }

    const sortedWs = Array.from(workspaces).sort((a, b) => a.localeCompare(b));
    workspaceSelect.innerHTML = "";
    workspaceSelect.appendChild(el("option", { value: "all" }, ["All workspaces"]));
    for (const w of sortedWs) workspaceSelect.appendChild(el("option", { value: w }, [w]));
    if (normalizeText(state.workspace).toLowerCase() === "all") {
      workspaceSelect.value = "all";
    } else if (state.workspace && Array.from(workspaces).some((w) => w.toLowerCase() === state.workspace.toLowerCase())) {
      workspaceSelect.value = state.workspace;
    } else {
      state.workspace = defaultWorkspace;
      workspaceSelect.value = defaultWorkspace;
    }

    kindSelect.value = state.kind;
    viewSelect.value = state.view;

    if (!listName) {
      thisWeekCard.lastChild.textContent = "Connect a SharePoint Agenda list to start.";
      next10Card.lastChild.textContent = "Connect a SharePoint Agenda list to start.";
      redFlagsCard.lastChild.textContent = "Connect a SharePoint Agenda list to start.";
      registersCard.lastChild.textContent = "Connect a SharePoint Agenda list to start.";
      return;
    }

    if (loadError) {
      thisWeekCard.lastChild.textContent = loadError.message || String(loadError);
      next10Card.lastChild.textContent = loadError.message || String(loadError);
      redFlagsCard.lastChild.textContent = loadError.message || String(loadError);
      registersCard.innerHTML = "";
      registersCard.appendChild(el("h3", {}, ["Registers"]));
      registersCard.appendChild(el("div", { class: "error" }, [
        `Could not load list "${listName}".`,
        el("div", { class: "small", style: "margin-top:8px;" }, [String(loadError.message || loadError)])
      ]));
      return;
    }

    const filtered = filteredItems();

    const actionItems = filtered.filter((it) => normalizeKind(it.Kind).toLowerCase() === "action");
    const decisionItems = filtered.filter((it) => normalizeKind(it.Kind).toLowerCase() === "decision");
    const riskItems = filtered.filter((it) => normalizeKind(it.Kind).toLowerCase() === "risk");
    const projectItems = filtered.filter((it) => normalizeKind(it.Kind).toLowerCase() === "project");
    const noteItems = filtered.filter((it) => normalizeKind(it.Kind).toLowerCase() === "note");

    // This Week
    const weekLines = actionItems
      .filter((it) => {
        const due = parseDate(it.DueDate);
        if (!due) return false;
        const s = normalizeText(it.Status).toLowerCase();
        if (["done", "complete", "closed"].includes(s)) return false;
        return inRange(due, weekStart, weekEnd);
      })
      .slice()
      .sort((a, b) => String(a.DueDate || "").localeCompare(String(b.DueDate || "")))
      .slice(0, 8)
      .map((it) => {
        const bits = [];
        bits.push(normalizeText(it.Title) || "(untitled)");
        const tail = safeJoin([
          state.view === "internal" ? ownerLabel(cfg, it.Owner) : "",
          normalizeText(it.Status),
          toDateValue(it.DueDate)
        ]);
        return tail ? `${bits.join("")} — ${tail}` : bits.join("");
      });

    renderListLines(thisWeekCard.lastChild, weekLines);

    // Next 10 Days
    const nextLines = actionItems
      .filter((it) => {
        const due = parseDate(it.DueDate);
        if (!due) return false;
        const s = normalizeText(it.Status).toLowerCase();
        if (["done", "complete", "closed"].includes(s)) return false;
        return due.valueOf() <= tenDays.valueOf();
      })
      .slice()
      .sort((a, b) => String(a.DueDate || "").localeCompare(String(b.DueDate || "")))
      .slice(0, 8)
      .map((it) => {
        const title = normalizeText(it.Title) || "(untitled)";
        const tail = safeJoin([normalizeText(it.Status), toDateValue(it.DueDate)]);
        return tail ? `${title} — ${tail}` : title;
      });

    renderListLines(next10Card.lastChild, nextLines);

    // Red flags
    const redLines = riskItems
      .filter((it) => {
        const impact = normalizeText(it.Impact).toLowerCase();
        const likelihood = normalizeText(it.Likelihood).toLowerCase();
        return impact === "high" || likelihood === "high" || normalizeText(it.Status).toLowerCase() === "blocked";
      })
      .slice(0, 8)
      .map((it) => {
        const title = normalizeText(it.Title) || "(untitled)";
        const tail = safeJoin([normalizeText(it.Likelihood), normalizeText(it.Impact), normalizeText(it.Status)]);
        return tail ? `${title} — ${tail}` : title;
      });

    renderListLines(redFlagsCard.lastChild, redLines);

    // Registers
    registersCard.innerHTML = "";
    registersCard.appendChild(el("h3", {}, ["Registers"]));

    const baseActionsCols = [
      { label: "Kind", render: (r) => kindPill(r.Kind) },
      { label: "Title", render: (r) => normalizeText(r.Title) || "(untitled)" },
      ...(state.view === "internal"
        ? [
            { label: "Owner", render: (r) => ownerLabel(cfg, r.Owner), muted: true },
            { label: "Status", render: (r) => statusPill(r.Status) },
            { label: "Due", render: (r) => toDateValue(r.DueDate), muted: true },
            { label: "DoD", render: (r) => normalizeText(r.DoD), muted: true }
          ]
        : [
            { label: "Status", render: (r) => statusPill(r.Status) },
            { label: "Date", render: (r) => toDateValue(r.DueDate), muted: true },
            { label: "Summary", render: (r) => normalizeText(r.PublicDetails || r.PublicSummary) }
          ]),
      {
        label: "Actions",
        render: (r) => [
          el("div", { class: "chiprow" }, [
            button("Edit", { onClick: () => openEditModal({ cfg, sp, listName, item: r, onSaved: async () => { await load(); rerender(); } }) }),
            ...(r.webUrl ? [el("a", { class: "btn", href: r.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"])] : [])
          ])
        ]
      }
    ];

    registersCard.appendChild(renderTable({
      title: "Action Register",
      rows: actionItems,
      columns: baseActionsCols,
      emptyText: "No action items yet."
    }));

    registersCard.appendChild(renderTable({
      title: "Decision Log",
      rows: decisionItems,
      columns: [
        { label: "Kind", render: (r) => kindPill(r.Kind) },
        { label: "Topic", render: (r) => normalizeText(r.Title) || "(untitled)" },
        { label: "Date", render: (r) => toDateValue(r.DueDate), muted: true },
        ...(state.view === "internal"
          ? [
              { label: "Decision", render: (r) => normalizeText(r.Details), muted: true },
              { label: "Owner", render: (r) => ownerLabel(cfg, r.Owner), muted: true },
              { label: "Impacted", render: (r) => normalizeText(r.ImpactedDepts), muted: true },
              { label: "OML", render: (r) => (isTruthy(r.OML) ? "Y" : "N"), muted: true },
              { label: "PRR", render: (r) => (isTruthy(r.PRR) ? "Y" : "N"), muted: true }
            ]
          : [{ label: "Summary", render: (r) => normalizeText(r.PublicDetails || r.PublicSummary) }]),
        {
          label: "Actions",
          render: (r) => [
            el("div", { class: "chiprow" }, [
              button("Edit", { onClick: () => openEditModal({ cfg, sp, listName, item: r, onSaved: async () => { await load(); rerender(); } }) }),
              ...(r.webUrl ? [el("a", { class: "btn", href: r.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"])] : [])
            ])
          ]
        }
      ],
      emptyText: "No decisions logged yet."
    }));

    registersCard.appendChild(renderTable({
      title: "Risk & Blocker Log",
      rows: riskItems,
      columns: [
        { label: "Kind", render: (r) => kindPill(r.Kind) },
        { label: "Description", render: (r) => normalizeText(r.Title) || "(untitled)" },
        ...(state.view === "internal"
          ? [
              { label: "Likelihood", render: (r) => normalizeText(r.Likelihood), muted: true },
              { label: "Impact", render: (r) => normalizeText(r.Impact), muted: true },
              { label: "Mitigation", render: (r) => normalizeText(r.Mitigation || r.Details), muted: true },
              { label: "Owner", render: (r) => ownerLabel(cfg, r.Owner), muted: true },
              { label: "Status", render: (r) => statusPill(r.Status) }
            ]
          : [{ label: "Summary", render: (r) => normalizeText(r.PublicDetails || r.PublicSummary) }]),
        {
          label: "Actions",
          render: (r) => [
            el("div", { class: "chiprow" }, [
              button("Edit", { onClick: () => openEditModal({ cfg, sp, listName, item: r, onSaved: async () => { await load(); rerender(); } }) }),
              ...(r.webUrl ? [el("a", { class: "btn", href: r.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"])] : [])
            ])
          ]
        }
      ],
      emptyText: "No risks logged yet."
    }));

    registersCard.appendChild(renderTable({
      title: "Project Portfolio (Active Initiatives)",
      rows: projectItems,
      columns: [
        { label: "Kind", render: (r) => kindPill(r.Kind) },
        { label: "Project", render: (r) => normalizeText(r.Title) || "(untitled)" },
        { label: "Module", render: (r) => normalizeText(r.Module), muted: true },
        { label: "Target", render: (r) => toDateValue(r.DueDate), muted: true },
        ...(state.view === "internal"
          ? [
              { label: "Owner", render: (r) => ownerLabel(cfg, r.Owner), muted: true },
              { label: "Funding", render: (r) => normalizeText(r.Funding), muted: true },
              { label: "Compliance", render: (r) => normalizeText(r.Compliance), muted: true }
            ]
          : [{ label: "Summary", render: (r) => normalizeText(r.PublicDetails || r.PublicSummary) }]),
        {
          label: "Actions",
          render: (r) => [
            el("div", { class: "chiprow" }, [
              button("Edit", { onClick: () => openEditModal({ cfg, sp, listName, item: r, onSaved: async () => { await load(); rerender(); } }) }),
              ...(r.webUrl ? [el("a", { class: "btn", href: r.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"])] : [])
            ])
          ]
        }
      ],
      emptyText: "No projects logged yet."
    }));

    registersCard.appendChild(renderTable({
      title: "Notes",
      rows: noteItems,
      columns: [
        { label: "Kind", render: (r) => kindPill(r.Kind) },
        { label: "Title", render: (r) => normalizeText(r.Title) || "(untitled)" },
        ...(state.view === "internal"
          ? [{ label: "Details", render: (r) => normalizeText(r.Details), muted: true }]
          : [{ label: "Summary", render: (r) => normalizeText(r.PublicDetails || r.PublicSummary) }]),
        {
          label: "Actions",
          render: (r) => [
            el("div", { class: "chiprow" }, [
              button("Edit", { onClick: () => openEditModal({ cfg, sp, listName, item: r, onSaved: async () => { await load(); rerender(); } }) }),
              ...(r.webUrl ? [el("a", { class: "btn", href: r.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"])] : [])
            ])
          ]
        }
      ],
      emptyText: "No notes yet."
    }));
  }

  setIntakeLabels();
  rerender();

  const actions = [
    {
      label: "Copy Public Markdown",
      onClick: async () => {
        const weekStart = startOfWeekMonday(new Date());
        const weekEnd = endOfWeekSunday(new Date());
        const wantWs = normalizeText(state.workspace || defaultWorkspace);
        const filtered =
          wantWs.toLowerCase() === "all"
            ? items
            : items.filter((it) => normalizeText(it.Workspace).toLowerCase() === wantWs.toLowerCase());
        const md = buildPublicMarkdown({ townLabel, weekStart, weekEnd, items: filtered });
        try {
          await navigator.clipboard.writeText(md);
          showModal({ title: "Copied", body: el("div", { class: "notice" }, ["Public Markdown copied to clipboard."]) });
        } catch (e) {
          showModal({
            title: "Copy failed",
            body: el("div", { class: "error", style: "white-space: pre-wrap;" }, [
              "Could not access clipboard. Copy manually:\n\n",
              md
            ])
          });
        }
      }
    }
  ];

  const grid = el("div", { class: "grid" }, [
    execSummary,
    intakeCard,
    controlsCard,
    thisWeekCard,
    next10Card,
    redFlagsCard,
    registersCard,
    el("div", { class: "card", style: "grid-column: span 12;" }, [
      el("h3", {}, ["IP / Safety Notice"]),
      el("div", { class: "small" }, [
        "This agenda reflects PublicLogic™ methods and may reference VAULT™/ARCHIEVE™ at a high level only. Mechanics are proprietary and intentionally omitted. ",
        "Keep PII out of this portal; link to secure systems for sensitive records."
      ])
    ])
  ]);

  return {
    title: "Living Agenda",
    subtitle: `${townLabel} • singular intake + public toggle`,
    actions,
    content: grid
  };
}
