import { el } from "../lib/dom.js";
import { pill, showModal, button } from "../lib/ui.js";
import { openCreateTaskModal } from "../lib/forms.js";

const STATUS_ORDER = ["Today", "This Week", "Backlog", "Blocked", "Done"];

function normalizeStatus(s) {
  const x = String(s || "").trim();
  if (!x) return "Backlog";
  return x;
}

function compareStatus(a, b) {
  const ia = STATUS_ORDER.indexOf(normalizeStatus(a));
  const ib = STATUS_ORDER.indexOf(normalizeStatus(b));
  const ra = ia === -1 ? 999 : ia;
  const rb = ib === -1 ? 999 : ib;
  return ra - rb;
}

function statusPill(status) {
  const s = normalizeStatus(status);
  const key = s.toLowerCase();
  if (key === "done") return pill("Done", "mint");
  if (key === "blocked") return pill("Blocked", "rose");
  if (key === "today") return pill("Today", "gold");
  return pill(s, "");
}

function quickSetButtons({ sp, listName, itemId, onUpdated }) {
  const set = async (Status) => {
    await sp.updateItemFields(listName, itemId, { Status });
    onUpdated();
  };

  return el("div", { class: "chiprow" }, [
    button("Today", { onClick: () => set("Today") }),
    button("This Week", { onClick: () => set("This Week") }),
    button("Blocked", { onClick: () => set("Blocked"), variant: "danger" }),
    button("Done", { onClick: () => set("Done"), variant: "primary" })
  ]);
}

function openEditTaskModal({ cfg, sp, task, onUpdated }) {
  const title = el("input", { class: "input", value: task.Title || "" });
  const owner = el("input", { class: "input", value: task.Owner || "" });
  const status = el("input", { class: "input", value: task.Status || "" });
  const due = el("input", { class: "input", type: "date", value: (task.DueDate || "").slice(0, 10) });
  const priority = el("input", { class: "input", value: task.Priority || "" });
  const area = el("input", { class: "input", value: task.Area || "" });
  const notes = el("textarea", { class: "textarea" }, [task.Notes || ""]);

  const body = el("div", { class: "form" }, [
    el("div", {}, [el("div", { class: "label" }, ["Task"]), title]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Owner"]), owner]),
      el("div", {}, [el("div", { class: "label" }, ["Status"]), status])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Due"]), due]),
      el("div", {}, [el("div", { class: "label" }, ["Priority"]), priority])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Area"]), area]),
    el("div", {}, [el("div", { class: "label" }, ["Notes"]), notes]),
    el("div", { class: "hr" }),
    el("div", { class: "small" }, ["Quick set:"]),
    quickSetButtons({ sp, listName: cfg.sharepoint.lists.tasks, itemId: task.itemId, onUpdated })
  ]);

  const modal = showModal({
    title: "Edit Task",
    body,
    actions: [
      {
        label: "Save",
        variant: "primary",
        onClick: async () => {
          await sp.updateItemFields(cfg.sharepoint.lists.tasks, task.itemId, {
            Title: title.value.trim(),
            Owner: owner.value.trim(),
            Status: status.value.trim(),
            DueDate: due.value || null,
            Priority: priority.value.trim(),
            Area: area.value.trim(),
            Notes: notes.value
          });
          modal.close();
          onUpdated();
        }
      }
    ]
  });
}

function filterTasks(tasks, { ownerEmail, status } = {}) {
  const wantOwner = ownerEmail && ownerEmail !== "all" ? ownerEmail.toLowerCase() : null;
  const wantStatus = status && status !== "all" ? status.toLowerCase() : null;

  return tasks.filter((t) => {
    if (wantOwner) {
      const o = String(t.Owner || "").toLowerCase();
      if (o !== wantOwner) return false;
    }
    if (wantStatus) {
      const s = String(t.Status || "").toLowerCase();
      if (s !== wantStatus) return false;
    }
    return true;
  });
}

export async function renderTasks(ctx) {
  const { cfg, sp } = ctx;

  let tasks = [];
  let error = null;

  try {
    tasks = await sp.listItems(cfg.sharepoint.lists.tasks, { selectFields: ["Title", "Owner", "Status", "DueDate", "Priority", "Area", "Notes"] });
  } catch (e) {
    error = e;
  }

  const ownerOptions = [
    { label: "All", value: "all" },
    ...((cfg.team?.people || []).map((p) => ({ label: p.name, value: p.email })))
  ];

  const statusOptions = [
    { label: "All", value: "all" },
    ...STATUS_ORDER.map((s) => ({ label: s, value: s }))
  ];

  const state = {
    owner: "all",
    status: "all"
  };

  const ownerSelect = el("select", { class: "select" }, ownerOptions.map((o) => el("option", { value: o.value }, [o.label])));
  const statusSelect = el("select", { class: "select" }, statusOptions.map((o) => el("option", { value: o.value }, [o.label])));

  ownerSelect.addEventListener("change", () => {
    state.owner = ownerSelect.value;
    rerenderTable();
  });

  statusSelect.addEventListener("change", () => {
    state.status = statusSelect.value;
    rerenderTable();
  });

  const controls = el("div", { class: "split" }, [
    el("div", {}, [el("div", { class: "label" }, ["Owner"]), ownerSelect]),
    el("div", {}, [el("div", { class: "label" }, ["Status"]), statusSelect])
  ]);

  const tableWrap = el("div", {});

  function rerenderTable() {
    tableWrap.innerHTML = "";

    if (error) {
      tableWrap.appendChild(el("div", { class: "error" }, [error.message]));
      return;
    }

    const filtered = filterTasks(tasks, { ownerEmail: state.owner, status: state.status })
      .slice()
      .sort((a, b) => {
        const cs = compareStatus(a.Status, b.Status);
        if (cs !== 0) return cs;
        const da = String(a.DueDate || "");
        const db = String(b.DueDate || "");
        return da.localeCompare(db);
      });

    if (filtered.length === 0) {
      tableWrap.appendChild(el("div", { class: "notice" }, ["No tasks match your filters yet."]));
      return;
    }

    const table = el("table", { class: "table" });
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        el("th", {}, ["Task"]),
        el("th", {}, ["Owner"]),
        el("th", {}, ["Status"]),
        el("th", {}, ["Due"]),
        el("th", {}, ["Priority"]),
        el("th", {}, ["Area"]),
        el("th", {}, ["Actions"])
      ])
    ]));

    const tbody = el("tbody");
    for (const t of filtered) {
      const tr = el("tr");
      tr.appendChild(el("td", {}, [t.Title || "(no title)"]));
      tr.appendChild(el("td", { class: "row-muted" }, [t.Owner || ""]));
      tr.appendChild(el("td", {}, [statusPill(t.Status)]));
      tr.appendChild(el("td", { class: "row-muted" }, [String(t.DueDate || "").slice(0, 10)]));
      tr.appendChild(el("td", { class: "row-muted" }, [t.Priority || ""]));
      tr.appendChild(el("td", { class: "row-muted" }, [t.Area || ""]));

      const actions = el("td", {}, [
        el("div", { class: "chiprow" }, [
          button("Edit", { onClick: () => openEditTaskModal({ cfg, sp, task: t, onUpdated: ctx.refresh }) }),
          ...(t.webUrl ? [el("a", { class: "btn", href: t.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"]) ] : []),
          button("Done", { variant: "primary", onClick: async () => {
            await sp.updateItemFields(cfg.sharepoint.lists.tasks, t.itemId, { Status: "Done" });
            ctx.refresh();
          } })
        ])
      ]);

      tr.appendChild(actions);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    tableWrap.appendChild(table);
  }

  rerenderTable();

  const actions = [
    {
      label: "New Task",
      variant: "primary",
      onClick: () => openCreateTaskModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    }
  ];

  const content = el("div", {}, [
    el("div", { class: "card" }, [
      el("h3", {}, ["Filters"]),
      controls
    ]),
    el("div", { style: "height: 12px;" }),
    el("div", { class: "card" }, [
      el("h3", {}, ["Task List"]),
      tableWrap
    ])
  ]);

  return {
    title: "Tasks",
    subtitle: "Shared commitments for you and Allie (stored in Microsoft Lists)",
    actions,
    content
  };
}
