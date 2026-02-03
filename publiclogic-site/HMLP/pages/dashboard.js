import { el } from "../lib/dom.js";
import { pill } from "../lib/ui.js";
import { formatLocalDateTime, formatLocalTime, startOfToday, endOfToday } from "../lib/time.js";
import { getMyCalendarView } from "../lib/m365.js";
import { openCreateTaskModal, openCreateLeadModal, openCreateProjectModal } from "../lib/forms.js";

function safeCountLabel(n, singular, plural) {
  if (n === 1) return `${n} ${singular}`;
  return `${n} ${plural}`;
}

function kpiCard({ title, value, label, kind = "mint" }) {
  return el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, [title]),
    el("div", { class: "kpi" }, [
      el("div", { class: "kpi__value" }, [String(value)]),
      el("div", { class: "kpi__label" }, [label])
    ]),
    el("div", { style: "margin-top: 10px;" }, [pill("Live", kind)])
  ]);
}

function listLine(left, right) {
  return el("div", { style: "display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--line);" }, [
    el("div", { style: "font-weight:700;" }, [left]),
    el("div", { style: "color: var(--muted); font-size: 12px; font-weight: 700;" }, [right])
  ]);
}

export async function renderDashboard(ctx) {
  const { cfg, auth, sp } = ctx;

  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  let events = [];
  let tasks = [];
  let pipeline = [];
  let projects = [];

  const errors = [];

  try {
    events = await getMyCalendarView(auth, { start: todayStart, end: todayEnd, top: 8 });
  } catch (e) {
    errors.push(`Calendar: ${e.message}`);
  }

  try {
    tasks = await sp.listItems(cfg.sharepoint.lists.tasks, { selectFields: ["Title", "Owner", "Status", "DueDate", "Priority", "Area"] });
  } catch (e) {
    errors.push(`Tasks list: ${e.message}`);
  }

  try {
    pipeline = await sp.listItems(cfg.sharepoint.lists.pipeline, { selectFields: ["Title", "Stage", "Owner", "NextStep", "NextDate"] });
  } catch (e) {
    errors.push(`Pipeline list: ${e.message}`);
  }

  try {
    projects = await sp.listItems(cfg.sharepoint.lists.projects, { selectFields: ["Title", "Client", "Status", "Owner", "TargetDate"] });
  } catch (e) {
    errors.push(`Projects list: ${e.message}`);
  }

  const openTasks = tasks.filter((t) => (t.Status || "").toLowerCase() !== "done");
  const followups = pipeline.filter((l) => !String(l.Stage || "").toLowerCase().includes("closed"));
  const activeProjects = projects.filter((p) => String(p.Status || "").toLowerCase() === "active");

  const grid = el("div", { class: "grid" });

  grid.appendChild(kpiCard({
    title: "Open Tasks",
    value: openTasks.length,
    label: safeCountLabel(openTasks.length, "commitment", "commitments"),
    kind: "mint"
  }));

  grid.appendChild(kpiCard({
    title: "Pipeline",
    value: followups.length,
    label: safeCountLabel(followups.length, "active lead", "active leads"),
    kind: "gold"
  }));

  grid.appendChild(kpiCard({
    title: "Projects",
    value: activeProjects.length,
    label: safeCountLabel(activeProjects.length, "active project", "active projects"),
    kind: "mint"
  }));

  const calendarCard = el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, ["Today"]),
    ...(events.length === 0
      ? [el("div", { class: "small" }, ["No events found for today (or permissions not granted)."])]
      : events.filter((e) => !e.isCancelled).slice(0, 6).map((e) => {
          const start = e.start?.dateTime || e.start;
          const end = e.end?.dateTime || e.end;
          const when = start && end ? `${formatLocalTime(start)}-${formatLocalTime(end)}` : formatLocalDateTime(start);
          return listLine(e.subject || "(no subject)", when);
        }))
  ]);

  const tasksCard = el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, ["This Week" ]),
    ...(openTasks
      .filter((t) => ["this week", "today", "blocked"].includes(String(t.Status || "").toLowerCase()))
      .slice(0, 6)
      .map((t) => {
        const due = String(t.DueDate || "").slice(0, 10);
        const rightBits = [t.Owner, t.Priority, due].filter(Boolean).join(" | ");
        return listLine(t.Title || "(no title)", rightBits || "");
      })),
    ...(openTasks.length === 0 ? [el("div", { class: "small" }, ["No tasks yet - create one to start the week."])]: [])
  ]);

  const pipelineCard = el("div", { class: "card", style: "grid-column: span 12;" }, [
    el("h3", {}, ["Pipeline Next Steps"]),
    ...(followups
      .slice(0, 8)
      .map((l) => {
        const nextDate = String(l.NextDate || "").slice(0, 10);
        const rightBits = [l.Stage, l.Owner, nextDate].filter(Boolean).join(" | ");
        const left = [l.Title, l.NextStep].filter(Boolean).join(" - ");
        return listLine(left || "(no org)", rightBits || "");
      })),
    ...(followups.length === 0 ? [el("div", { class: "small" }, ["Pipeline is empty - add a lead."])]: [])
  ]);

  grid.appendChild(calendarCard);
  grid.appendChild(tasksCard);
  grid.appendChild(pipelineCard);

  if (errors.length > 0) {
    grid.prepend(el("div", { class: "error", style: "grid-column: span 12;" }, [
      el("div", {}, ["Some panels couldn't load yet:"]),
      el("div", { class: "small", style: "margin-top:8px; white-space: pre-wrap;" }, [errors.join("\n")])
    ]));
  }

  const actions = [
    {
      label: "New Task",
      variant: "primary",
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

  const subtitle = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  return {
    title: "Command Center",
    subtitle,
    actions,
    content: el("div", {}, [grid])
  };
}
