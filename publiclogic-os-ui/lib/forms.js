import { el } from "./dom.js";
import { showModal, button } from "./ui.js";

function compactFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = v;
  }
  return out;
}

function optionList(values, selected) {
  return values.map((v) => el("option", { value: v, ...(v === selected ? { selected: "selected" } : {}) }, [v]));
}

function inputRow(labelText, inputEl) {
  return el("div", {}, [
    el("div", { class: "label" }, [labelText]),
    inputEl
  ]);
}

export function openCreateTaskModal({ cfg, sp, defaultOwnerEmail, onCreated = null } = {}) {
  const owners = (cfg.team?.people || []).map((p) => p.email);
  const statusOptions = ["Backlog", "This Week", "Today", "Blocked", "Done"];
  const priorityOptions = ["P0", "P1", "P2"];
  const areaOptions = ["Ops", "Sales", "Delivery", "Admin"];

  const title = el("input", { class: "input", placeholder: "Write the task like a commitment...", value: "" });
  const owner = el("select", { class: "select" }, optionList(owners.length ? owners : [defaultOwnerEmail || ""], defaultOwnerEmail || owners[0]));
  const status = el("select", { class: "select" }, optionList(statusOptions, "This Week"));
  const due = el("input", { class: "input", type: "date" });
  const priority = el("select", { class: "select" }, optionList(priorityOptions, "P1"));
  const area = el("select", { class: "select" }, optionList(areaOptions, "Ops"));
  const notes = el("textarea", { class: "textarea", placeholder: "Context, constraints, definition of done..." });

  const body = el("div", { class: "form" }, [
    inputRow("Task", title),
    el("div", { class: "split" }, [
      inputRow("Owner", owner),
      inputRow("Status", status)
    ]),
    el("div", { class: "split" }, [
      inputRow("Due", due),
      inputRow("Priority", priority)
    ]),
    inputRow("Area", area),
    inputRow("Notes", notes)
  ]);

  const { close } = showModal({
    title: "New Task",
    body,
    actions: [
      {
        label: "Create",
        variant: "primary",
        onClick: async () => {
          const fields = {
            Title: title.value.trim(),
            Owner: owner.value || "",
            Status: status.value,
            DueDate: due.value || null,
            Priority: priority.value,
            Area: area.value,
            Notes: notes.value.trim()
          };

          if (!fields.Title) {
            title.focus();
            return;
          }

          await sp.createItem(cfg.sharepoint.lists.tasks, compactFields(fields));
          close();
          if (onCreated) onCreated();
        }
      }
    ]
  });
}

export function openCreateLeadModal({ cfg, sp, defaultOwnerEmail, onCreated = null } = {}) {
  const owners = (cfg.team?.people || []).map((p) => p.email);
  const stageOptions = ["Lead", "Discovery", "Proposal", "Active", "Closed Won", "Closed Lost"];

  const org = el("input", { class: "input", placeholder: "Town / city / org..." });
  const contactName = el("input", { class: "input", placeholder: "Name" });
  const contactEmail = el("input", { class: "input", placeholder: "Email" });
  const stage = el("select", { class: "select" }, optionList(stageOptions, "Lead"));
  const owner = el("select", { class: "select" }, optionList(owners.length ? owners : [defaultOwnerEmail || ""], defaultOwnerEmail || owners[0]));
  const nextStep = el("input", { class: "input", placeholder: "Next step" });
  const nextDate = el("input", { class: "input", type: "date" });
  const notes = el("textarea", { class: "textarea", placeholder: "Notes" });

  const body = el("div", { class: "form" }, [
    inputRow("Organization", org),
    el("div", { class: "split" }, [
      inputRow("Contact", contactName),
      inputRow("Email", contactEmail)
    ]),
    el("div", { class: "split" }, [
      inputRow("Stage", stage),
      inputRow("Owner", owner)
    ]),
    el("div", { class: "split" }, [
      inputRow("Next Step", nextStep),
      inputRow("Next Date", nextDate)
    ]),
    inputRow("Notes", notes)
  ]);

  const { close } = showModal({
    title: "New Lead",
    body,
    actions: [
      {
        label: "Create",
        variant: "primary",
        onClick: async () => {
          const fields = {
            Title: org.value.trim(),
            ContactName: contactName.value.trim(),
            ContactEmail: contactEmail.value.trim(),
            Stage: stage.value,
            Owner: owner.value || "",
            NextStep: nextStep.value.trim(),
            NextDate: nextDate.value || null,
            Notes: notes.value.trim()
          };

          if (!fields.Title) {
            org.focus();
            return;
          }

          await sp.createItem(cfg.sharepoint.lists.pipeline, compactFields(fields));
          close();
          if (onCreated) onCreated();
        }
      }
    ]
  });
}

export function openCreateProjectModal({ cfg, sp, defaultOwnerEmail, onCreated = null } = {}) {
  const owners = (cfg.team?.people || []).map((p) => p.email);
  const statusOptions = ["Active", "Paused", "Complete"];

  const name = el("input", { class: "input", placeholder: "Project name" });
  const client = el("input", { class: "input", placeholder: "Client / town" });
  const status = el("select", { class: "select" }, optionList(statusOptions, "Active"));
  const owner = el("select", { class: "select" }, optionList(owners.length ? owners : [defaultOwnerEmail || ""], defaultOwnerEmail || owners[0]));
  const start = el("input", { class: "input", type: "date" });
  const target = el("input", { class: "input", type: "date" });
  const notes = el("textarea", { class: "textarea", placeholder: "Milestones, scope, constraints..." });

  const body = el("div", { class: "form" }, [
    inputRow("Project", name),
    el("div", { class: "split" }, [
      inputRow("Client", client),
      inputRow("Status", status)
    ]),
    el("div", { class: "split" }, [
      inputRow("Owner", owner),
      inputRow("Start", start)
    ]),
    inputRow("Target", target),
    inputRow("Notes", notes)
  ]);

  const { close } = showModal({
    title: "New Project",
    body,
    actions: [
      {
        label: "Create",
        variant: "primary",
        onClick: async () => {
          const fields = {
            Title: name.value.trim(),
            Client: client.value.trim(),
            Status: status.value,
            Owner: owner.value || "",
            StartDate: start.value || null,
            TargetDate: target.value || null,
            Notes: notes.value.trim()
          };

          if (!fields.Title) {
            name.focus();
            return;
          }

          await sp.createItem(cfg.sharepoint.lists.projects, compactFields(fields));
          close();
          if (onCreated) onCreated();
        }
      }
    ]
  });
}
