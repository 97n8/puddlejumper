import { el } from "../lib/dom.js";

function toolButton(t) {
  return el(
    "a",
    {
      class: "btn",
      href: t.url,
      target: "_blank",
      rel: "noreferrer",
      title: t.url
    },
    [t.title]
  );
}

function card(title, children) {
  return el("div", { class: "card" }, [
    el("h3", {}, [title]),
    ...children
  ]);
}

export async function renderTools(ctx) {
  const { cfg } = ctx;

  const spHost = cfg.sharepoint?.hostname;
  const spPath = cfg.sharepoint?.sitePath;
  const siteUrl = spHost && spPath ? `https://${spHost}${spPath}` : null;

  function listUrl(listTitle) {
    if (!siteUrl) return null;
    return `${siteUrl}/Lists/${encodeURIComponent(listTitle)}/AllItems.aspx`;
  }

  const tools = Array.isArray(cfg.tools) ? cfg.tools : [];

  const quick = card("Quick Launch", [
    tools.length === 0
      ? el("div", { class: "small" }, ["Add tools in config.js to show them here."])
      : el("div", { class: "chiprow" }, tools.map(toolButton))
  ]);

  const osData = card("OS Data (Microsoft Lists)", [
    el("div", { class: "small" }, ["These are the shared databases that power Tasks / Pipeline / Projects."]),
    el("div", { class: "hr" }),
    el("div", { class: "chiprow" }, [
      ...(cfg.sharepoint?.lists?.tasks ? [toolButton({ title: "Tasks List", url: listUrl(cfg.sharepoint.lists.tasks) || "#" })] : []),
      ...(cfg.sharepoint?.lists?.pipeline ? [toolButton({ title: "Pipeline List", url: listUrl(cfg.sharepoint.lists.pipeline) || "#" })] : []),
      ...(cfg.sharepoint?.lists?.projects ? [toolButton({ title: "Projects List", url: listUrl(cfg.sharepoint.lists.projects) || "#" })] : []),
      ...(siteUrl ? [toolButton({ title: "SharePoint OS Site", url: siteUrl })] : [])
    ].filter((a) => a.getAttribute("href") !== "#"))
  ]);

  const comms = card("Communication", [
    el("div", { class: "chiprow" }, [
      toolButton({ title: "Teams", url: "https://teams.microsoft.com/" }),
      toolButton({ title: "Outlook Mail", url: "https://outlook.office.com/mail/" }),
      toolButton({ title: "Outlook Calendar", url: "https://outlook.office.com/calendar/" })
    ])
  ]);

  const ops = card("Ops", [
    el("div", { class: "chiprow" }, [
      toolButton({ title: "OneDrive", url: "https://www.office.com/launch/onedrive" }),
      toolButton({ title: "Microsoft Lists", url: "https://www.office.com/launch/lists" })
    ])
  ]);

  const content = el("div", {}, [
    el("div", { class: "grid" }, [
      el("div", { style: "grid-column: span 12;" }, [quick]),
      el("div", { style: "grid-column: span 12;" }, [osData]),
      el("div", { style: "grid-column: span 6;" }, [comms]),
      el("div", { style: "grid-column: span 6;" }, [ops])
    ])
  ]);

  return {
    title: "Tools",
    subtitle: "All the places you work (one hub)",
    actions: [],
    content
  };
}
