import { el, clear } from "./lib/dom.js";
import { getConfig, validateConfig } from "./lib/config.js";
import { createAuth, getSignedInEmail, isAllowedAccount } from "./lib/auth.js";
import { createSharePointClient } from "./lib/sharepoint.js";
import { getRoute, onRouteChange, setRoute } from "./lib/router.js";
import { establishPjSession } from "./lib/pj.js";

import { renderDashboard }    from "./pages/dashboard.js";
import { renderToday }        from "./pages/today.js";
import { renderTasks }        from "./pages/tasks.js";
import { renderPipeline }     from "./pages/pipeline.js";
import { renderProjects }     from "./pages/projects.js";
import { renderPlaybooks }    from "./pages/playbooks.js";
import { renderTools }        from "./pages/tools.js";
import { renderSettings }     from "./pages/settings.js";
import { renderAgenda }       from "./pages/agenda.js";
import { renderPuddleJumper } from "./pages/puddlejumper.js";

function actionNode(a) {
  if (a.href) {
    return el("a", {
      class: ["btn", a.variant ? `btn--${a.variant}` : ""].filter(Boolean).join(" "),
      href: a.href, target: "_blank", rel: "noreferrer"
    }, [a.label]);
  }
  return el("button", {
    class: ["btn", a.variant ? `btn--${a.variant}` : ""].filter(Boolean).join(" "),
    type: "button", onclick: a.onClick
  }, [a.label]);
}

function renderSetup(appEl, { errors = [] } = {}) {
  clear(appEl);
  appEl.appendChild(el("div", { class: "boot" }, [
    el("div", { class: "brand" }, [
      el("div", { class: "brand__mark" }, ["PL"]),
      el("div", {}, [
        el("div", { class: "brand__name" }, ["PublicLogic OS"]),
        el("div", { class: "brand__tag" }, ["Private operations portal"])
      ])
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "notice" }, [
      "This OS is not configured yet.",
      el("div", { class: "small", style: "margin-top: 8px;" }, [
        "Copy config.example.js → config.js and fill in your Microsoft 365 + SharePoint settings."
      ])
    ]),
    ...(errors.length > 0
      ? [el("div", { class: "error", style: "margin-top: 12px; white-space: pre-wrap;" }, [errors.join("\n")])]
      : []),
    el("div", { style: "margin-top: 12px;" }, [
      el("div", { class: "chiprow" }, [
        el("a", { class: "btn btn--primary", href: "./SETUP.md",  target: "_blank", rel: "noreferrer" }, ["Open SETUP.md"]),
        el("a", { class: "btn",             href: "./DEPLOY.md", target: "_blank", rel: "noreferrer" }, ["Open DEPLOY.md"])
      ])
    ])
  ]));
}

function renderSignedOut(appEl, { onLogin }) {
  clear(appEl);
  appEl.appendChild(el("div", { class: "boot" }, [
    el("div", { class: "brand" }, [
      el("div", { class: "brand__mark" }, ["PL"]),
      el("div", {}, [
        el("div", { class: "brand__name" }, ["PublicLogic OS"]),
        el("div", { class: "brand__tag" }, ["Sign in with Microsoft 365"])
      ])
    ]),
    el("div", { class: "hr" }),
    el("button", { class: "btn btn--primary", onclick: onLogin }, ["Sign In with Microsoft 365"]),
    el("div", { class: "small", style: "margin-top: 12px;" }, [
      "Only allowed emails can access this portal. Choose your @publiclogic.org account."
    ])
  ]));
}

function renderNotAllowed(appEl, { email, allowedEmails, onLogout }) {
  clear(appEl);
  appEl.appendChild(el("div", { class: "boot" }, [
    el("div", { class: "brand" }, [
      el("div", { class: "brand__mark" }, ["PL"]),
      el("div", {}, [
        el("div", { class: "brand__name" }, ["Access Denied"]),
        el("div", { class: "brand__tag" }, ["This portal is private"])
      ])
    ]),
    el("div", { class: "hr" }),
    el("div", { class: "error" }, [
      `Signed in as ${email || "(unknown)"}, but this account is not on the allow list.`,
      el("div", { class: "small", style: "margin-top: 8px;" }, [
        `Allowed: ${(allowedEmails || []).join(", ")}`
      ])
    ]),
    el("div", { style: "margin-top: 12px;" }, [
      el("button", { class: "btn btn--danger", onclick: onLogout }, ["Sign Out"])
    ])
  ]));
}

function buildShell({ onLogout, whoText, pjAdminUrl }) {
  const sidebarTop = el("div", { class: "sidebar__top" }, [
    el("div", { class: "sidebar__who" }, [
      el("b", {}, ["PublicLogic OS"]),
      el("span", {}, [whoText || ""])
    ]),
    el("button", { class: "btn", onclick: onLogout }, ["Sign Out"])
  ]);

  const navItems = [
    { path: "/dashboard",    label: "Command Center", icon: "◈" },
    { path: "/today",        label: "Today",          icon: "◷" },
    { path: "/agenda",       label: "Agenda",         icon: "⊞" },
    { path: "/tasks",        label: "Tasks",          icon: "✓" },
    { path: "/pipeline",     label: "Pipeline",       icon: "⟶" },
    { path: "/projects",     label: "Projects",       icon: "⊿" },
    { path: "/playbooks",    label: "Playbooks",      icon: "⬡" },
    { path: "/tools",        label: "Tools",          icon: "⊙" },
    { path: "/settings",     label: "Settings",       icon: "◎" }
  ];

  const nav = el("nav", { class: "nav" });
  for (const n of navItems) {
    const a = el("a", { href: `#${n.path}` }, [
      el("span", { class: "nav__icon"  }, [n.icon]),
      el("span", { class: "nav__label" }, [n.label])
    ]);
    a.dataset.path = n.path;
    nav.appendChild(a);
  }

  if (pjAdminUrl) {
    const pjInternal = el("a", { href: "#/puddlejumper", class: "nav__pj" }, [
      el("span", { class: "nav__icon"  }, ["⚡"]),
      el("span", { class: "nav__label" }, ["PuddleJumper"])
    ]);
    pjInternal.dataset.path = "/puddlejumper";
    nav.appendChild(pjInternal);

    nav.appendChild(el("a", {
      class: "nav__external",
      href: pjAdminUrl, target: "_blank", rel: "noreferrer",
      title: "Open PuddleJumper admin panel directly"
    }, [
      el("span", { class: "nav__icon"  }, ["↗"]),
      el("span", { class: "nav__label nav__label--muted" }, ["PJ Admin ↗"])
    ]));
  }

  const sidebar  = el("aside", { class: "sidebar" }, [sidebarTop, nav]);
  const titleEl  = el("h1", { class: "h1" }, [""]);
  const subEl    = el("p",  { class: "sub" }, [""]);
  const actionsEl = el("div", { class: "main__actions" });
  const top      = el("div", { class: "main__top"  }, [el("div", {}, [titleEl, subEl]), actionsEl]);
  const contentEl = el("div", { class: "content" });
  const main     = el("main", { class: "main" }, [top, contentEl]);
  const shell    = el("div",  { class: "shell" }, [sidebar, main]);

  return { shell, nav, titleEl, subEl, actionsEl, contentEl };
}

function setActiveNav(navEl, path) {
  for (const a of Array.from(navEl.querySelectorAll("a[data-path]"))) {
    if (a.dataset.path === path) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

const PAGES = {
  "/":              renderDashboard,
  "/dashboard":     renderDashboard,
  "/today":         renderToday,
  "/agenda":        renderAgenda,
  "/tasks":         renderTasks,
  "/pipeline":      renderPipeline,
  "/projects":      renderProjects,
  "/playbooks":     renderPlaybooks,
  "/tools":         renderTools,
  "/settings":      renderSettings,
  "/puddlejumper":  renderPuddleJumper
};

async function main() {
  const appEl = document.getElementById("app");
  const cfg   = getConfig();
  const configErrors = validateConfig(cfg);
  if (configErrors.length > 0) { renderSetup(appEl, { errors: configErrors }); return; }

  const auth = createAuth();
  await auth.init();

  const account = auth.getAccount();
  if (!account) { renderSignedOut(appEl, { onLogin: () => auth.login() }); return; }

  if (!isAllowedAccount(account, cfg.access.allowedEmails)) {
    renderNotAllowed(appEl, {
      email: getSignedInEmail(account),
      allowedEmails: cfg.access.allowedEmails,
      onLogout: () => auth.logout()
    });
    return;
  }

  const userEmail = getSignedInEmail(account);
  const sp        = createSharePointClient(auth);
  const shell     = buildShell({
    onLogout: () => auth.logout(),
    whoText: userEmail,
    pjAdminUrl: cfg.puddlejumper?.adminUrl || null
  });

  clear(appEl);
  appEl.appendChild(shell.shell);

  establishPjSession(auth).catch(() => { /* best-effort */ });

  const ctx = {
    cfg, auth, sp, userEmail,
    route: getRoute(),
    refresh: async () => { await renderRoute(); }
  };

  async function renderRoute() {
    ctx.route = getRoute();
    const path     = ctx.route.path || "/";
    const renderer = PAGES[path] || renderDashboard;

    setActiveNav(shell.nav, path === "/" ? "/dashboard" : path);

    let page;
    try {
      page = await renderer(ctx);
    } catch (e) {
      page = {
        title: "Error", subtitle: "A page failed to load",
        actions: [],
        content: el("div", { class: "error" }, [String(e.message || e)])
      };
      console.error(e);
    }

    shell.titleEl.textContent = page.title    || "";
    shell.subEl.textContent   = page.subtitle || "";
    shell.actionsEl.innerHTML = "";
    for (const a of page.actions || []) shell.actionsEl.appendChild(actionNode(a));
    clear(shell.contentEl);
    shell.contentEl.appendChild(page.content || el("div", {}, [""]));
  }

  if (!window.location.hash) setRoute("/dashboard");
  onRouteChange(() => ctx.refresh());
  await renderRoute();
}

main().catch((e) => {
  const appEl = document.getElementById("app");
  renderSetup(appEl, { errors: [String(e.message || e)] });
});
