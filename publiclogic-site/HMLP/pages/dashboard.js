import { el } from "../lib/dom.js";
import { pill } from "../lib/ui.js";
import { formatLocalDateTime, formatLocalTime, startOfToday, endOfToday } from "../lib/time.js";
import { getMyCalendarView } from "../lib/m365.js";
import { openCreateTaskModal, openCreateLeadModal, openCreateProjectModal } from "../lib/forms.js";
import { checkPjSession } from "../lib/pj.js";

function safeCountLabel(n, singular, plural) {
  if (n === 1) return `${n} ${singular}`;
  return `${n} ${plural}`;
}

function kpiCard({ title, value, label, kind = "mint", href = null }) {
  const card = el("div", { class: "card kpi-card", style: "grid-column: span 3;" });
  const inner = el("div", { class: "kpi-card__inner" }, [
    el("div", { class: "kpi-card__title" }, [title]),
    el("div", { class: "kpi" }, [
      el("div", { class: "kpi__value" }, [String(value)]),
      el("div", { class: "kpi__label" }, [label])
    ]),
    el("div", { style: "margin-top: 10px;" }, [pill("Live", kind)])
  ]);
  if (href) {
    inner.style.cursor = "pointer";
    inner.addEventListener("click", () => { window.location.hash = href; });
  }
  card.appendChild(inner);
  return card;
}

function listLine(left, right, opts = {}) {
  const wrap = el("div", {
    class: "list-line",
    style: opts.clickable ? "cursor:pointer;" : ""
  }, [
    el("div", { class: "list-line__left" }, typeof left === "string" ? [left] : [left]),
    el("div", { class: "list-line__right" }, [right])
  ]);
  if (opts.onClick) wrap.addEventListener("click", opts.onClick);
  return wrap;
}

async function renderPjPanel(cfg) {
  const pjCfg = cfg.puddlejumper;
  const card = el("div", { class: "card pj-card", style: "grid-column: span 4;" });

  card.appendChild(el("div", { class: "pj-card__header" }, [
    el("div", { class: "pj-card__mark" }, ["⚡"]),
    el("div", {}, [
      el("div", { class: "pj-card__title" }, ["PuddleJumper"]),
      el("div", { class: "small" }, ["Governance engine"])
    ])
  ]));

  if (!pjCfg?.adminUrl) {
    card.appendChild(el("div", { class: "notice", style: "margin-top:10px;" }, [
      "Configure puddlejumper.adminUrl in config.js to enable."
    ]));
    return card;
  }

  const baseUrl = pjCfg.adminUrl.replace(/\/$/, "");

  const statusDot  = el("span", { class: "pj-status-dot pj-status-dot--checking" });
  const statusText = el("span", { class: "small" }, ["Checking session..."]);
  card.appendChild(el("div", { class: "pj-status-row" }, [statusDot, statusText]));

  checkPjSession().then((user) => {
    statusDot.className = user ? "pj-status-dot pj-status-dot--ok" : "pj-status-dot pj-status-dot--none";
    statusText.textContent = user
      ? `Session active${user.email ? " — " + user.email : ""}`
      : "No session — open PJ to sign in";
  }).catch(() => {
    statusDot.className = "pj-status-dot pj-status-dot--none";
    statusText.textContent = "Could not reach PuddleJumper";
  });

  const pjLinks = [
    { label: "Admin Panel",    param: "" },
    { label: "VAULT Schemas",  param: "?view=vault" },
    { label: "Encoding Queue", param: "?view=queue" },
    { label: "Audit Log",      param: "?view=audit" }
  ];

  const linksEl = el("div", { class: "pj-links" });
  for (const link of pjLinks) {
    linksEl.appendChild(el("a", {
      class: "pj-link",
      href: `${baseUrl}${link.param}`,
      target: "_blank",
      rel: "noreferrer"
    }, [
      el("span", {}, [link.label]),
      el("span", { class: "pj-link__arrow" }, ["→"])
    ]));
  }
  card.appendChild(linksEl);

  card.appendChild(el("a", {
    class: "btn btn--pj",
    href: baseUrl,
    target: "_blank",
    rel: "noreferrer",
    style: "margin-top: 12px; display: block; text-align: center;"
  }, ["Open PuddleJumper ⚡"]));

  card.appendChild(el("div", { style: "margin-top: 8px;" }, [
    el("a", { href: "#/puddlejumper", class: "small", style: "color:var(--muted); text-decoration:none;" },
      ["Full PJ panel →"])
  ]));

  return card;
}

export async function renderDashboard(ctx) {
  const { cfg, auth, sp } = ctx;

  const todayStart = startOfToday();
  const todayEnd   = endOfToday();

  let events   = [];
  let tasks    = [];
  let pipeline = [];
  let projects = [];
  const errors = [];

  // Parallel fetch — all four sources at once
  await Promise.allSettled([
    getMyCalendarView(auth, { start: todayStart, end: todayEnd, top: 8 })
      .then((r) => { events = r; })
      .catch((e) => { errors.push(`Calendar: ${e.message}`); }),

    sp.listItems(cfg.sharepoint.lists.tasks, {
      selectFields: ["Title", "Owner", "Status", "DueDate", "Priority", "Area"]
    }).then((r) => { tasks = r; })
      .catch((e) => { errors.push(`Tasks: ${e.message}`); }),

    sp.listItems(cfg.sharepoint.lists.pipeline, {
      selectFields: ["Title", "Stage", "Owner", "NextStep", "NextDate"]
    }).then((r) => { pipeline = r; })
      .catch((e) => { errors.push(`Pipeline: ${e.message}`); }),

    sp.listItems(cfg.sharepoint.lists.projects, {
      selectFields: ["Title", "Client", "Status", "Owner", "TargetDate"]
    }).then((r) => { projects = r; })
      .catch((e) => { errors.push(`Projects: ${e.message}`); })
  ]);

  const openTasks      = tasks.filter((t) => (t.Status || "").toLowerCase() !== "done");
  const urgentTasks    = openTasks.filter((t) =>
    ["today", "this week", "blocked"].includes(String(t.Status || "").toLowerCase())
  );
  const blockedTasks   = openTasks.filter((t) =>
    String(t.Status || "").toLowerCase() === "blocked"
  );
  const followups      = pipeline.filter((l) =>
    !String(l.Stage || "").toLowerCase().includes("closed")
  );
  const activeProjects = projects.filter((p) =>
    String(p.Status || "").toLowerCase() === "active"
  );

  const grid = el("div", { class: "grid" });

  if (errors.length > 0) {
    grid.appendChild(el("div", { class: "error", style: "grid-column: span 12;" }, [
      el("div", {}, ["Some panels couldn't load:"]),
      el("div", { class: "small", style: "margin-top:6px; white-space: pre-wrap;" }, [errors.join("\n")])
    ]));
  }

  // KPI row
  grid.appendChild(kpiCard({
    title: "Open Tasks", value: openTasks.length,
    label: safeCountLabel(openTasks.length, "commitment", "commitments"),
    kind: "mint", href: "#/tasks"
  }));
  grid.appendChild(kpiCard({
    title: "Urgent / Blocked", value: urgentTasks.length,
    label: `${blockedTasks.length} blocked`,
    kind: blockedTasks.length > 0 ? "rose" : "mint", href: "#/tasks"
  }));
  grid.appendChild(kpiCard({
    title: "Pipeline", value: followups.length,
    label: safeCountLabel(followups.length, "active lead", "active leads"),
    kind: "gold", href: "#/pipeline"
  }));
  grid.appendChild(kpiCard({
    title: "Active Projects", value: activeProjects.length,
    label: safeCountLabel(activeProjects.length, "in delivery", "in delivery"),
    kind: "mint", href: "#/projects"
  }));

  // Calendar
  const calendarCard = el("div", { class: "card", style: "grid-column: span 5;" }, [
    el("h3", {}, ["Today's Calendar"]),
    ...(events.length === 0
      ? [el("div", { class: "small" }, ["No events today (or permissions not granted)."])]
      : events.filter((e) => !e.isCancelled).slice(0, 6).map((e) => {
          const start = e.start?.dateTime || e.start;
          const end   = e.end?.dateTime   || e.end;
          const when  = start && end
            ? `${formatLocalTime(start)}–${formatLocalTime(end)}`
            : formatLocalDateTime(start);
          return listLine(e.subject || "(no subject)", when, {
            clickable: !!e.webLink,
            onClick: e.webLink ? () => window.open(e.webLink, "_blank", "noreferrer") : null
          });
        })),
    el("div", { style: "margin-top: 12px;" }, [
      el("a", { class: "btn", href: "#/today" }, ["Full Day View →"])
    ])
  ]);

  // This week
  const tasksCard = el("div", { class: "card", style: "grid-column: span 3;" }, [
    el("h3", {}, ["This Week"]),
    ...(urgentTasks.length === 0
      ? [el("div", { class: "small" }, [
          openTasks.length === 0
            ? "No open tasks — add one to start."
            : "Nothing flagged for today or this week."
        ])]
      : urgentTasks.slice(0, 6).map((t) => {
          const due   = String(t.DueDate || "").slice(0, 10);
          const right = [t.Priority, due].filter(Boolean).join(" | ");
          const isBlocked = String(t.Status || "").toLowerCase() === "blocked";
          const titleEl = el("span", {}, [t.Title || "(no title)"]);
          if (isBlocked) {
            titleEl.appendChild(
              el("span", { style: "color:var(--danger); font-weight:800; font-size:11px; margin-left:4px;" },
                ["⚠"])
            );
          }
          return listLine(titleEl, right);
        })),
    el("div", { style: "margin-top: 12px;" }, [
      el("a", { class: "btn", href: "#/tasks" }, ["All Tasks →"])
    ])
  ]);

  // PuddleJumper panel (async, renders inline)
  const pjPanel = await renderPjPanel(cfg);

  grid.appendChild(calendarCard);
  grid.appendChild(tasksCard);
  grid.appendChild(pjPanel);

  // Pipeline
  const pipelineCard = el("div", { class: "card", style: "grid-column: span 8;" }, [
    el("h3", {}, ["Pipeline — Next Steps"]),
    ...(followups.length === 0
      ? [el("div", { class: "small" }, ["Pipeline is empty — add a lead."])]
      : followups.slice(0, 6).map((l) => {
          const nextDate = String(l.NextDate || "").slice(0, 10);
          const right = [l.Stage, l.Owner, nextDate].filter(Boolean).join(" | ");
          const left  = [l.Title, l.NextStep].filter(Boolean).join(" — ");
          return listLine(left || "(no org)", right);
        })),
    el("div", { style: "margin-top: 12px;" }, [
      el("a", { class: "btn", href: "#/pipeline" }, ["Full Pipeline →"])
    ])
  ]);

  // Active projects summary
  const projectsCard = el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, ["Active Projects"]),
    ...(activeProjects.length === 0
      ? [el("div", { class: "small" }, ["No active projects."])]
      : activeProjects.slice(0, 5).map((p) => {
          const target = String(p.TargetDate || "").slice(0, 10);
          return listLine(p.Title || "(untitled)", [p.Client, target].filter(Boolean).join(" | "));
        })),
    el("div", { style: "margin-top: 12px;" }, [
      el("a", { class: "btn", href: "#/projects" }, ["All Projects →"])
    ])
  ]);

  grid.appendChild(pipelineCard);
  grid.appendChild(projectsCard);

  const actions = [
    {
      label: "New Task", variant: "primary",
      onClick: () => openCreateTaskModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    },
    {
      label: "New Lead",
      onClick: () => openCreateLeadModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    },
    {
      label: "New Project",
      onClick: () => openCreateProjectModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    }
  ];

  const subtitle = new Date().toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric"
  });

  return { title: "Command Center", subtitle, actions, content: el("div", {}, [grid]) };
}
