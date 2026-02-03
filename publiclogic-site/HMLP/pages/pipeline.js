import { el } from "../lib/dom.js";
import { pill, showModal, button } from "../lib/ui.js";
import { openCreateLeadModal } from "../lib/forms.js";

const STAGES = ["Lead", "Discovery", "Proposal", "Active", "Closed Won", "Closed Lost"];

function stagePill(stage) {
  const s = String(stage || "Lead");
  const key = s.toLowerCase();
  if (key.includes("won")) return pill("Closed Won", "mint");
  if (key.includes("lost")) return pill("Closed Lost", "rose");
  if (key === "proposal") return pill("Proposal", "gold");
  if (key === "discovery") return pill("Discovery", "gold");
  if (key === "active") return pill("Active", "mint");
  return pill(s, "");
}

function openEditLeadModal({ cfg, sp, lead, onUpdated }) {
  const org = el("input", { class: "input", value: lead.Title || "" });
  const contactName = el("input", { class: "input", value: lead.ContactName || "" });
  const contactEmail = el("input", { class: "input", value: lead.ContactEmail || "" });
  const stage = el("select", { class: "select" }, STAGES.map((s) => el("option", { value: s, ...(String(lead.Stage || "Lead") === s ? { selected: "selected" } : {}) }, [s])));
  const owner = el("input", { class: "input", value: lead.Owner || "" });
  const nextStep = el("input", { class: "input", value: lead.NextStep || "" });
  const nextDate = el("input", { class: "input", type: "date", value: (lead.NextDate || "").slice(0, 10) });
  const notes = el("textarea", { class: "textarea" }, [lead.Notes || ""]);

  const body = el("div", { class: "form" }, [
    el("div", {}, [el("div", { class: "label" }, ["Organization"]), org]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Contact"]), contactName]),
      el("div", {}, [el("div", { class: "label" }, ["Email"]), contactEmail])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Stage"]), stage]),
      el("div", {}, [el("div", { class: "label" }, ["Owner"]), owner])
    ]),
    el("div", { class: "split" }, [
      el("div", {}, [el("div", { class: "label" }, ["Next Step"]), nextStep]),
      el("div", {}, [el("div", { class: "label" }, ["Next Date"]), nextDate])
    ]),
    el("div", {}, [el("div", { class: "label" }, ["Notes"]), notes]),
    el("div", { class: "hr" }),
    el("div", { class: "small" }, ["Quick close:"]),
    el("div", { class: "chiprow" }, [
      button("Closed Won", { variant: "primary", onClick: async () => {
        await sp.updateItemFields(cfg.sharepoint.lists.pipeline, lead.itemId, { Stage: "Closed Won" });
        onUpdated();
      } }),
      button("Closed Lost", { variant: "danger", onClick: async () => {
        await sp.updateItemFields(cfg.sharepoint.lists.pipeline, lead.itemId, { Stage: "Closed Lost" });
        onUpdated();
      } })
    ])
  ]);

  const modal = showModal({
    title: "Edit Lead",
    body,
    actions: [
      {
        label: "Save",
        variant: "primary",
        onClick: async () => {
          await sp.updateItemFields(cfg.sharepoint.lists.pipeline, lead.itemId, {
            Title: org.value.trim(),
            ContactName: contactName.value.trim(),
            ContactEmail: contactEmail.value.trim(),
            Stage: stage.value,
            Owner: owner.value.trim(),
            NextStep: nextStep.value.trim(),
            NextDate: nextDate.value || null,
            Notes: notes.value
          });
          modal.close();
          onUpdated();
        }
      }
    ]
  });
}

export async function renderPipeline(ctx) {
  const { cfg, sp } = ctx;

  let leads = [];
  let error = null;

  try {
    leads = await sp.listItems(cfg.sharepoint.lists.pipeline, { selectFields: ["Title", "ContactName", "ContactEmail", "Stage", "Owner", "NextStep", "NextDate", "Notes"] });
  } catch (e) {
    error = e;
  }

  const active = leads
    .slice()
    .sort((a, b) => {
      const sa = String(a.Stage || "");
      const sb = String(b.Stage || "");
      const ia = STAGES.indexOf(sa);
      const ib = STAGES.indexOf(sb);
      const ra = ia === -1 ? 999 : ia;
      const rb = ib === -1 ? 999 : ib;
      if (ra !== rb) return ra - rb;
      const da = String(a.NextDate || "");
      const db = String(b.NextDate || "");
      return da.localeCompare(db);
    });

  const content = el("div", {}, [
    error
      ? el("div", { class: "error" }, [error.message])
      : el("div", { class: "card" }, [
          el("h3", {}, ["Leads"]),
          active.length === 0
            ? el("div", { class: "notice" }, ["No leads yet. Add one and this becomes your pipeline system."])
            : (() => {
                const table = el("table", { class: "table" });
                table.appendChild(el("thead", {}, [
                  el("tr", {}, [
                    el("th", {}, ["Organization"]),
                    el("th", {}, ["Stage"]),
                    el("th", {}, ["Owner"]),
                    el("th", {}, ["Next"]),
                    el("th", {}, ["Actions"])
                  ])
                ]));

                const tbody = el("tbody");
                for (const l of active) {
                  const tr = el("tr");

                  const left = el("div", {}, [
                    el("div", { style: "font-weight: 800;" }, [l.Title || "(no org)"])
                  ]);

                  const contactBits = [l.ContactName, l.ContactEmail].filter(Boolean).join(" | ");
                  if (contactBits) left.appendChild(el("div", { class: "small" }, [contactBits]));

                  const nextBits = [l.NextStep, String(l.NextDate || "").slice(0, 10)].filter(Boolean).join(" | ");

                  tr.appendChild(el("td", {}, [left]));
                  tr.appendChild(el("td", {}, [stagePill(l.Stage)]));
                  tr.appendChild(el("td", { class: "row-muted" }, [l.Owner || ""]));
                  tr.appendChild(el("td", { class: "row-muted" }, [nextBits]));

                  tr.appendChild(el("td", {}, [
                    el("div", { class: "chiprow" }, [
                      button("Edit", { onClick: () => openEditLeadModal({ cfg, sp, lead: l, onUpdated: ctx.refresh }) }),
                      ...(l.webUrl ? [el("a", { class: "btn", href: l.webUrl, target: "_blank", rel: "noreferrer" }, ["Open"]) ] : [])
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
      label: "New Lead",
      variant: "primary",
      onClick: () => openCreateLeadModal({ cfg, sp, defaultOwnerEmail: ctx.userEmail, onCreated: ctx.refresh })
    }
  ];

  return {
    title: "Pipeline",
    subtitle: "Sales follow-ups and municipal opportunities",
    actions,
    content
  };
}
