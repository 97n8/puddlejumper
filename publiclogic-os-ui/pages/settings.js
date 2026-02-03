import { el } from "../lib/dom.js";
import { button } from "../lib/ui.js";
import { validateConfig } from "../lib/config.js";

export async function renderSettings(ctx) {
  const { cfg, sp } = ctx;

  const configErrors = validateConfig(cfg);
  const status = configErrors.length === 0 ? "OK" : "Needs setup";

  const results = el("div", {});

  async function runChecks() {
    results.innerHTML = "";

    const lines = [];

    try {
      const site = await sp.getSite();
      lines.push(`SharePoint site: OK (${site.displayName || site.name || site.id})`);
    } catch (e) {
      lines.push(`SharePoint site: FAIL (${e.message})`);
    }

    const listNames = Object.values(cfg.sharepoint?.lists || {}).filter(Boolean);
    for (const name of listNames) {
      try {
        await sp.listItems(name, { selectFields: ["Title"], top: 1 });
        lines.push(`List: OK (${name})`);
      } catch (e) {
        lines.push(`List: FAIL (${name}) - ${e.message}`);
      }
    }

    results.appendChild(el("pre", { style: "white-space: pre-wrap; margin: 0; font-size: 12px; color: rgba(247,245,239,0.85);" }, [lines.join("\n")]));
  }

  const content = el("div", {}, [
    el("div", { class: "card" }, [
      el("h3", {}, ["Status"]),
      el("div", { class: "small" }, [`Config: ${status}`]),
      ...(configErrors.length > 0
        ? [el("div", { class: "error", style: "margin-top: 12px;" }, [configErrors.join("\n")])]
        : [el("div", { class: "notice", style: "margin-top: 12px;" }, ["Looks good. If something fails, run connection checks."])])
    ]),

    el("div", { style: "height: 12px;" }),

    el("div", { class: "card" }, [
      el("h3", {}, ["Connection Checks"]),
      el("div", { class: "small" }, ["Verifies SharePoint site + lists are reachable with your current Microsoft login."]),
      el("div", { style: "margin-top: 12px;" }, [
        button("Run Checks", { variant: "primary", onClick: runChecks })
      ]),
      el("div", { class: "hr" }),
      results
    ]),

    el("div", { style: "height: 12px;" }),

    el("div", { class: "card" }, [
      el("h3", {}, ["Setup Docs"]),
      el("div", { class: "chiprow" }, [
        el("a", { class: "btn", href: "./SETUP.md", target: "_blank", rel: "noreferrer" }, ["Open SETUP.md"]),
        el("a", { class: "btn", href: "./DEPLOY.md", target: "_blank", rel: "noreferrer" }, ["Open DEPLOY.md"])
      ])
    ])
  ]);

  return {
    title: "Settings",
    subtitle: "Configuration, connectivity, and setup",
    actions: [],
    content
  };
}
