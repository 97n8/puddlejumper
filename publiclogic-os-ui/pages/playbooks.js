import { el } from "../lib/dom.js";

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.json();
}

async function fetchText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.text();
}

function renderMarkdown(md) {
  // eslint-disable-next-line no-undef
  if (!window.marked) return el("pre", {}, [md]);

  // eslint-disable-next-line no-undef
  const html = window.marked.parse(md, {
    gfm: true,
    breaks: false
  });

  return el("div", { class: "markdown", html });
}

export async function renderPlaybooks(ctx) {
  const route = ctx.route;
  const docParam = route.query.get("doc");

  let index = [];
  let md = "";
  let selected = null;
  let error = null;

  try {
    index = await fetchJson("./content/playbooks/index.json");
    selected = index.find((d) => d.id === docParam) || index[0] || null;
    if (selected) md = await fetchText(`./content/playbooks/${selected.id}`);
  } catch (e) {
    error = e;
  }

  const nav = el("div", { class: "card" }, [
    el("h3", {}, ["Playbooks"]),
    ...(index.length === 0
      ? [el("div", { class: "small" }, ["No playbooks found."])]
      : index.map((d) => {
          const href = `#/playbooks?doc=${encodeURIComponent(d.id)}`;
          const a = el("a", {
            href,
            class: "navlink",
            ...(selected?.id === d.id ? { "data-active": "1" } : {})
          }, [d.title]);
          return a;
        }))
  ]);

  const body = error
    ? el("div", { class: "error" }, [error.message])
    : selected
      ? el("div", { class: "card" }, [
          el("h3", {}, [selected.title]),
          el("div", { class: "small" }, ["These are the rules and rituals. Keep them current."]),
          el("div", { class: "hr" }),
          renderMarkdown(md)
        ])
      : el("div", { class: "notice" }, ["No playbook selected."]);

  const grid = el("div", { class: "grid" }, [
    el("div", { style: "grid-column: span 4;" }, [nav]),
    el("div", { style: "grid-column: span 8;" }, [body])
  ]);

  return {
    title: "Playbooks",
    subtitle: "How PublicLogic runs (single source of truth)",
    actions: [],
    content: grid
  };
}
