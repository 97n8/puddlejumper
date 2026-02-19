# PublicLogic OS (UI)

This is a private, Microsoft 365-connected operations portal for PublicLogic.

It is designed for you + Allie to run the business from one place:
- Calendar (Today)
- Living Agenda (singular intake + internal/public toggle)
- Shared Tasks / Pipeline / Projects (Microsoft Lists in SharePoint)
- Playbooks (the operating system docs)
- Tool hub (links to 365 + your stack)

## What This Is
- A static web app (no backend) you can host on Netlify.
- Authentication is Microsoft Entra ID (MSAL) and data is Microsoft Graph.

## What This Is Not
- A public marketing site.
- A new SaaS product.

## Route → File Map

The app uses hash-based routing (`#/path`). Each route maps to a render
function in `pages/`:

| URL hash | Label | Source file |
|---|---|---|
| `#/` or `#/dashboard` | Command Center | `pages/dashboard.js` |
| `#/today` | Today | `pages/today.js` |
| `#/agenda` | Agenda | `pages/agenda.js` |
| `#/tasks` | Tasks | `pages/tasks.js` |
| `#/pipeline` | Pipeline | `pages/pipeline.js` |
| `#/projects` | Projects | `pages/projects.js` |
| `#/playbooks` | Playbooks | `pages/playbooks.js` |
| `#/tools` | Tools | `pages/tools.js` |
| `#/puddlejumper` | ⚡ PuddleJumper | `pages/puddlejumper.js` |
| `#/settings` | Settings | `pages/settings.js` |

Routing is handled by `lib/router.js`; the route table lives in `app.js`
(the `PAGES` object).

## Quick Start (Local)
This is a static site. You can serve it with Ruby:

```bash
ruby -run -e httpd publiclogic-os-ui -p 8000
```

Then open:
- http://localhost:8000/

## Setup
Follow:
- SETUP.md
- DEPLOY.md

Most likely URL for you:
- `https://www.publiclogic.org/HMLP/`
