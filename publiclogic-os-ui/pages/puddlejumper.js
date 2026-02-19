/**
 * PuddleJumper Page
 *
 * Dedicated panel for the PuddleJumper governance engine.
 * Shows session status, deep links into PJ admin views,
 * and the SSO bridge health — all without embedding an iframe
 * (avoids X-Frame-Options conflicts on Fly.io).
 */

import { el } from "../lib/dom.js";
import { button, pill, showModal } from "../lib/ui.js";
import { checkPjSession, establishPjSession } from "../lib/pj.js";

const PJ_VIEWS = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "◈",
    description: "Overview of all active governance work",
    param: ""
  },
  {
    id: "vault",
    label: "VAULT Schemas",
    icon: "⬡",
    description: "Active VAULT module configurations and encoding status",
    param: "?view=vault"
  },
  {
    id: "queue",
    label: "Encoding Queue",
    icon: "⟳",
    description: "Pending governance encoding tasks and review items",
    param: "?view=queue"
  },
  {
    id: "audit",
    label: "Audit Log",
    icon: "⊞",
    description: "Timestamped record of all governance actions",
    param: "?view=audit"
  },
  {
    id: "continuity",
    label: "Continuity Packs",
    icon: "⊿",
    description: "Transferable documentation bundles by module",
    param: "?view=continuity"
  },
  {
    id: "flags",
    label: "Stop-Rule Flags",
    icon: "⚑",
    description: "Active encoding stops requiring PublicLogic review",
    param: "?view=flags"
  },
  {
    id: "clients",
    label: "Client Workspaces",
    icon: "⊙",
    description: "Per-municipality VAULT installations and status",
    param: "?view=clients"
  },
  {
    id: "settings",
    label: "PJ Settings",
    icon: "◎",
    description: "Integration config, API keys, and provider settings",
    param: "?view=settings"
  }
];

function sessionStatusBadge(user) {
  if (user === null) {
    return el("div", { class: "pj-session-badge pj-session-badge--active" }, [
      el("span", { class: "pj-session-dot pj-session-dot--active" }),
      el("span", {}, [`Session active — ${user?.email || "you"}`])
    ]);
  }
  return el("div", { class: "pj-session-badge pj-session-badge--none" }, [
    el("span", { class: "pj-session-dot pj-session-dot--none" }),
    el("span", {}, ["No active PJ session"])
  ]);
}

function viewCard({ label, icon, description, url }) {
  return el("a", {
    class: "pj-view-card",
    href: url,
    target: "_blank",
    rel: "noreferrer",
    style: "grid-column: span 3;"
  }, [
    el("div", { class: "pj-view-card__icon" }, [icon]),
    el("div", { class: "pj-view-card__label" }, [label]),
    el("div", { class: "pj-view-card__desc" }, [description]),
    el("div", { class: "pj-view-card__arrow" }, ["Open →"])
  ]);
}

export async function renderPuddleJumper(ctx) {
  const { cfg, auth } = ctx;
  const pjCfg = cfg.puddlejumper;

  if (!pjCfg?.adminUrl || !pjCfg?.apiUrl) {
    return {
      title: "PuddleJumper",
      subtitle: "Governance encoding engine",
      actions: [],
      content: el("div", { class: "card" }, [
        el("h3", {}, ["Not Configured"]),
        el("div", { class: "notice" }, [
          "Add puddlejumper.apiUrl and puddlejumper.adminUrl to config.js to enable this panel."
        ]),
        el("div", { class: "small", style: "margin-top: 12px;" }, [
          "Example:\n  puddlejumper: {\n    apiUrl: \"https://publiclogic-puddlejumper.fly.dev\",\n    adminUrl: \"https://pj.publiclogic.org/pj/admin\"\n  }"
        ])
      ])
    };
  }

  const baseUrl = pjCfg.adminUrl.replace(/\/$/, "");
  const apiUrl = pjCfg.apiUrl.replace(/\/$/, "");

  // --- Session card ---
  const sessionCard = el("div", { class: "card pj-session-card", style: "grid-column: span 12;" });

  sessionCard.appendChild(el("div", { class: "pj-hero" }, [
    el("div", { class: "pj-hero__left" }, [
      el("div", { class: "pj-hero__mark" }, ["⚡"]),
      el("div", {}, [
        el("div", { class: "pj-hero__title" }, ["PuddleJumper"]),
        el("div", { class: "pj-hero__sub" }, [
          "Governance encoding engine — operated by Polimorphic, governed by PublicLogic"
        ])
      ])
    ]),
    el("div", { class: "pj-hero__right" }, [
      el("a", {
        class: "btn btn--pj",
        href: baseUrl,
        target: "_blank",
        rel: "noreferrer"
      }, ["Open PuddleJumper ⚡"])
    ])
  ]));

  // Session status (loads async)
  const sessionStatus = el("div", { class: "pj-session-row" }, [
    el("div", { class: "small" }, ["Checking session..."])
  ]);
  sessionCard.appendChild(sessionStatus);

  const sessionActions = el("div", { class: "chiprow", style: "margin-top: 12px;" });
  sessionCard.appendChild(sessionActions);

  // Check + refresh session non-blocking
  (async () => {
    try {
      let user = await checkPjSession();

      if (!user) {
        // Try to re-establish via SSO bridge
        user = await establishPjSession(auth);
      }

      sessionStatus.innerHTML = "";

      if (user) {
        sessionStatus.appendChild(el("div", { class: "pj-session-active" }, [
          el("span", { class: "pj-dot pj-dot--ok" }),
          el("span", {}, [
            `Session active`,
            user.email ? el("span", { class: "small", style: "margin-left:8px;" }, [`(${user.email})`]) : ""
          ].filter(Boolean))
        ]));
        sessionActions.appendChild(
          el("a", {
            class: "btn btn--pj",
            href: baseUrl,
            target: "_blank",
            rel: "noreferrer"
          }, ["Open PJ Admin ⚡"])
        );
      } else {
        sessionStatus.appendChild(el("div", { class: "pj-session-none" }, [
          el("span", { class: "pj-dot pj-dot--none" }),
          el("span", {}, ["No active session — SSO bridge not established"])
        ]));
        sessionActions.appendChild(
          button("Retry SSO Bridge", {
            onClick: async () => {
              sessionStatus.innerHTML = "";
              sessionStatus.appendChild(el("div", { class: "small" }, ["Retrying..."]));
              try {
                const u = await establishPjSession(auth);
                sessionStatus.innerHTML = "";
                sessionStatus.appendChild(el("div", {
                  class: u ? "pj-session-active" : "pj-session-none"
                }, [
                  el("span", { class: `pj-dot pj-dot--${u ? "ok" : "none"}` }),
                  el("span", {}, [u ? "Session established" : "SSO bridge failed — open PJ to sign in manually"])
                ]));
              } catch {
                sessionStatus.innerHTML = "";
                sessionStatus.appendChild(el("div", { class: "pj-session-none" }, [
                  el("span", { class: "pj-dot pj-dot--none" }),
                  el("span", {}, ["Error connecting to PuddleJumper"])
                ]));
              }
            }
          })
        );
        sessionActions.appendChild(
          el("a", {
            class: "btn",
            href: baseUrl,
            target: "_blank",
            rel: "noreferrer"
          }, ["Sign In to PJ Manually"])
        );
      }
    } catch {
      sessionStatus.innerHTML = "";
      sessionStatus.appendChild(el("div", { class: "pj-session-none" }, [
        el("span", { class: "pj-dot pj-dot--none" }),
        el("span", {}, ["Could not reach PuddleJumper"])
      ]));
    }
  })();

  // --- Boundary notice ---
  const boundaryCard = el("div", { class: "card pj-boundary-card", style: "grid-column: span 12;" }, [
    el("div", { class: "pj-boundary-inner" }, [
      el("div", { class: "pj-boundary-icon" }, ["⬡"]),
      el("div", {}, [
        el("div", { class: "pj-boundary-title" }, ["Governance Boundary Protocol"]),
        el("div", { class: "small", style: "margin-top: 6px; line-height: 1.6;" }, [
          "VAULT defines governance. Polimorphic (PuddleJumper) handles encoding. ",
          "Any encoding that introduces dependency or new governance risk requires PublicLogic review before deployment. ",
          el("strong", {}, ["If PJ flags a stop rule, do not override — escalate to Nate."]),
        ])
      ])
    ])
  ]);

  // --- Quick access views grid ---
  const viewsGrid = el("div", { class: "grid", style: "margin-top: 0;" });

  for (const view of PJ_VIEWS) {
    viewsGrid.appendChild(viewCard({
      label: view.label,
      icon: view.icon,
      description: view.description,
      url: `${baseUrl}${view.param}`
    }));
  }

  const viewsCard = el("div", { class: "card", style: "grid-column: span 12;" }, [
    el("h3", {}, ["Quick Access"]),
    el("div", { class: "small", style: "margin-bottom: 14px;" }, [
      "All links open PuddleJumper in a new tab. SSO bridge should keep you signed in."
    ]),
    viewsGrid
  ]);

  // --- Integration details ---
  const infoCard = el("div", { class: "card", style: "grid-column: span 12;" }, [
    el("h3", {}, ["Integration Details"]),
    el("div", { class: "pj-info-grid" }, [
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["API Endpoint"]),
        el("code", { class: "pj-info-value" }, [apiUrl])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["Admin URL"]),
        el("code", { class: "pj-info-value" }, [baseUrl])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["SSO Provider"]),
        el("span", { class: "pj-info-value" }, ["Microsoft Entra ID (token exchange)"])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["Token Exchange"]),
        el("code", { class: "pj-info-value" }, [`${apiUrl}/api/auth/token-exchange`])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["Session Check"]),
        el("code", { class: "pj-info-value" }, [`${apiUrl}/api/session`])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["Governance Owner"]),
        el("span", { class: "pj-info-value" }, ["PublicLogic (Nate Boudreau, MPA MCPPO)"])
      ]),
      el("div", { class: "pj-info-row" }, [
        el("span", { class: "pj-info-label" }, ["Encoding Partner"]),
        el("span", { class: "pj-info-value" }, ["Polimorphic"])
      ])
    ])
  ]);

  const grid = el("div", { class: "grid" }, [
    sessionCard,
    boundaryCard,
    viewsCard,
    infoCard
  ]);

  const actions = [
    {
      label: "⚡ Open PuddleJumper",
      variant: "pj",
      href: baseUrl
    }
  ];

  return {
    title: "PuddleJumper",
    subtitle: "Governance encoding engine — Polimorphic integration",
    actions,
    content: grid
  };
}
