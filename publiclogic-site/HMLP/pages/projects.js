import { el } from "../lib/dom.js";
import { pill, showModal, button } from "../lib/ui.js";
import { openCreateProjectModal } from "../lib/forms.js";

function statusPill(status) {
  const s = String(status || "Active");
  const key = s.toLowerCase();
  if (key === "active") return pill("Active", "mint");
  if (key === "complete") return pill("Complete", "mint");
  if (key === "paused") return pill("Paused", "gold");
  return pill(s, "");
}

function openEditProjectModal({ cfg, sp, project, onUpdated }) {
  const name = el("input", { class: "input", value: project.Title || "" });
  const client = el("input", { class: "input", value: project.Client || "" });
  const status = el("input", { class: "input", value: project.Status || "" });
  const owner = el("input", { class: "input", value: project.Owner || "" });
  const start = el("input", { class: "input", type: "date", value: (project.StartDate || "").slice(0, 10) });
  const target = el("input", { class: "input", type: "date", value: (project.TargetDate || "").slice(0, 10) });
  const notes = el("textarea", { class: "textarea" }, [project.Notes || ""]);

  const body = el("div", { class: "form" }, [
    el("div", {}, [el("div", { class: "label" }, ["Project"]), name]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Client"]), client]),
      el("div", {}, [el("div", { class: "label" }, ["Status"]), status])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Owner"]), owner]),
      el("div", {}, [el("div", { class: "label" }, ["Start"]), start])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Target"]), target]),
    el("div", {}, [el("div", { class: "label" }, ["Notes"]), notes])
  ]);

  const modal = showModal({
    title: "Edit Project",
    body,
    actions: [
      {
        label: "Save",
        variant: "primary",
        onClick: async () => {
          await sp.updateItemFields(cfg.sharepoint.lists.projects, project.itemId, {
            Title: name.value.trim(),
            Client: client.value.trim(),
            Status: status.value.trim(),
            Owner: owner.value.trim(),
            StartDate: start.value || null,
            TargetDate: target.value || null,
            Notes: notes.value
          });
          modal.close();
          onUpdated();
        }
      }
    ]
  });
}

export async function renderProjects(ctx) {
  const { cfg, sp } = ctx;

  let projects = [];
  let error = null;

  try {
    projects = await sp.listItems(cfg.sharepoint.lists.projects, { selectFields: ["Title", "Client", "Status", "Owner", "StartDate", "TargetDate", "Notes"] });
  } catch (e) {
    error = e;
  }

  const sorted = projects
    .slice()
    .sort((a, b) => {
      const sa = String(a.Status || "").toLowerCase();
      const sb = String(b.Status || "").toLowerCase();
      if (sa !== sb) return sa.localeCompare(sb);
      const da = String(a.TargetDate || "");
      const db = String(b.TargetDate || "");
      return da.localeCompare(db);
    });

  const content = el("div", {}, [
    error
      ? el("div", { class: "error" }, [error.message])
      : el("div", { class: "card" }, [
          el("h3", {}, ["Projects"]),
          sorted.length === 0
            ? el("div", { class: "notice" }, ["No projects yet. Add one and track delivery here."])
            : (() => {
                const table = el("table", { class: "table" });
                table.appendChild(el("thead", {}, [
                  el("tr", {}, [
                    el("th", {}, ["Project"]),
                    el("th", {}, ["Client"]),
                    el("th", {}, ["Status"]),
                    el("th", {}, ["Owner"]),
                    el("th", {}, ["Target"]),
                    el("th", {}, ["Actions"])
                  ])
                ]));

                const tbody = el("tbody");
                for (const p of sorted) {
                  const tr = el("tr");
                  tr.appendChild(el("td", {}, [p.Title || "(no title)"]));
                  tr.appendChild(el("td", { class: "row-muted" }, [p.Client || ""]));
                  tr.appendChild(el("td", {}, [statusPill(p.Status)]));
                  tr.appendChild(el("td", { class: "row-muted" }, [p.Owner || ""]));
                  tr.appendChild(el("td", { class: "row-muted" }, [String(p.TargetDate || "").slice(0, 10)]));

                  tr.appendChild(el("td", {}, [
                    el("div", { class: "chiprow" }, [
                      button("Edit", { onClick: () => openEditProjectModal({ cfg, sp, project: p, onUpdated: ctx.refresh }) }),
                      ...(p.webUrl ? [el("a", { class: "btn", href: p.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"]) ] : [])
                    ])
                  ]));

                  tbody.appendChild(tr);
                }

                table.appendChild(tbody);
                return table;
              })()
        ])
  ]);

  const actions = [
    {
      label: "New Project",
      variant: "primary",
      onClick: () => openCreateProjectModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    }
  ];

  return {
    title: "Projects",
    subtitle: "Delivery work in motion (towns, pilots, and packages)",
    actions,
    content
  };
}
