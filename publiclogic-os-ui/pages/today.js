import { el } from "../lib/dom.js";
import { button, pill } from "../lib/ui.js";
import { formatLocalTime, startOfToday, endOfToday } from "../lib/time.js";
import { getMyCalendarView, getUserCalendarView } from "../lib/m365.js";

function eventLine(e) {
  const start = e.start?.dateTime || e.start;
  const end = e.end?.dateTime || e.end;
  const when = start && end ? `${formatLocalTime(start)}-${formatLocalTime(end)}` : "";
  const subject = e.subject || "(no subject)";
  const left = el("div", { style: "font-weight: 800;" }, [subject]);
  const right = el("div", { class: "row-muted" }, [when]);

  const wrap = el("div", { style: "display:flex; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--line);" }, [left, right]);
  if (e.webLink) {
    wrap.style.cursor = "pointer";
    wrap.title = "Open in Outlook";
    wrap.addEventListener("click", () => window.open(e.webLink, "_blank", "noreferrer"));
  }
  return wrap;
}

function copyToClipboard(text) {
  if (!navigator.clipboard) return false;
  navigator.clipboard.writeText(text).catch(() => {});
  return true;
}

function ritualCard(title, items) {
  return el("div", { class: "card", style: "grid-column: span 4;" }, [
    el("h3", {}, [title]),
    el("div", {}, items.map((it) => el("div", { style: "padding: 6px 0; border-bottom: 1px solid var(--line);" }, [
      el("span", { class: "row-muted" }, ["[ ] "]),
      el("span", {}, [it])
    ])))
  ]);
}

export async function renderToday(ctx) {
  const { cfg, auth } = ctx;

  const start = startOfToday();
  const end = endOfToday();

  const people = cfg.team?.people || [];
  const me = people.find((p) => String(p.email || "").toLowerCase() === String(ctx.userEmail || "").toLowerCase()) || { name: "Me", email: ctx.userEmail };
  const other = people.find((p) => String(p.email || "").toLowerCase() !== String(ctx.userEmail || "").toLowerCase());

  let myEvents = [];
  let otherEvents = [];
  let errors = [];

  try {
    myEvents = await getMyCalendarView(auth, { start, end, top: 12 });
  } catch (e) {
    errors.push(`Calendar (me): ${e.message}`);
  }

  if (other?.email) {
    try {
      otherEvents = await getUserCalendarView(auth, { userEmail: other.email, start, end, top: 12 });
    } catch (e) {
      errors.push(`Calendar (${other.name}): ${e.message}`);
    }
  }

  const scheduleGrid = el("div", { class: "grid" });

  if (errors.length > 0) {
    scheduleGrid.appendChild(el("div", { class: "error", style: "grid-column: span 12;" }, [
      el("div", {}, ["Calendar panels may need permissions or sharing:"]),
      el("div", { class: "small", style: "white-space: pre-wrap; margin-top: 8px;" }, [errors.join("\n")])
    ]));
  }

  scheduleGrid.appendChild(el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, [`${me.name} - Today`]),
    myEvents.filter((e) => !e.isCancelled).length === 0
      ? el("div", { class: "small" }, ["No events (or not granted)."])
      : el("div", {}, myEvents.filter((e) => !e.isCancelled).slice(0, 10).map(eventLine)),
    el("div", { style: "margin-top: 10px;" }, [
      el("a", { class: "btn", href: "https://outlook.office.com/calendar/", target: "_blank", rel: "noreferrer" }, ["Open Outlook Calendar"])
    ])
  ]));

  scheduleGrid.appendChild(el("div", { class: "card", style: "grid-column: span 6;" }, [
    el("h3", {}, [`${other?.name || "Allie"} - Today`]),
    other?.email
      ? (otherEvents.filter((e) => !e.isCancelled).length === 0
          ? el("div", { class: "small" }, ["No events found or calendar not shared."])
          : el("div", {}, otherEvents.filter((e) => !e.isCancelled).slice(0, 10).map(eventLine)))
      : el("div", { class: "notice" }, ["Add Allie to config.team.people to show both schedules."]),
    el("div", { style: "margin-top: 10px;" }, [
      pill("Tip: Share calendars in Outlook to make this truly seamless.", "gold")
    ])
  ]));

  const template = `Status for ${new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}\n\nToday:\n- 1)\n- 2)\n- 3)\n\nBlockers:\n-\n\nNeed from you:\n-`;

  const rituals = el("div", { class: "grid", style: "margin-top: 12px;" }, [
    ritualCard("Morning (10 min)", [
      "Scan calendar (you + Allie)",
      "Pick 3 outcomes for today",
      "Move tasks to Today / This Week",
      "Send status note in Teams"
    ]),
    ritualCard("Midday (5 min)", [
      "Check pipeline next steps",
      "Schedule follow-ups",
      "Escalate blockers early"
    ]),
    ritualCard("Close (8 min)", [
      "Mark done tasks",
      "Capture decisions",
      "Write tomorrow's first move"
    ])
  ]);

  const statusCard = el("div", { class: "card", style: "margin-top: 12px;" }, [
    el("h3", {}, ["Status Template"]),
    el("div", { class: "small" }, ["Use the same format every day so handoffs stay clean."]),
    el("div", { class: "hr" }),
    el("pre", { style: "white-space: pre-wrap; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; color: rgba(247,245,239,0.85);" }, [template]),
    el("div", { style: "margin-top: 12px;" }, [
      button("Copy to Clipboard", { variant: "primary", onClick: () => copyToClipboard(template) })
    ])
  ]);

  return {
    title: "Today",
    subtitle: "Your daily operating view (calendars + rituals)",
    actions: [],
    content: el("div", {}, [scheduleGrid, rituals, statusCard])
  };
}
