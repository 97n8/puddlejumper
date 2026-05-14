# PuddleJumper — User Quickstart

## Getting Started

Open **[pj.publiclogic.org](https://pj.publiclogic.org)** in your browser.

---

## Sign In

1. On the landing page you'll see three **Sign in** buttons:
   - **Sign in with GitHub**
   - **Sign in with Google**
   - **Sign in with Microsoft**

2. Click your preferred provider. You'll be redirected to that provider's login page.

3. Authorize PuddleJumper when prompted.

4. You'll be redirected back to `pj.publiclogic.org`. The header will show your **name** (or email) and a **Sign out** button — confirming you're authenticated.

> **Tip:** If you already have an active session with your provider, sign-in is nearly instant — a single click.

---

## What You'll See

| Area | Description |
|---|---|
| **Header** | Your name/email, workspace ID, and Sign out button |
| **Navigation links** | Capability-gated links (Governance, Dashboard) appear based on your permissions |
| **Live Tiles** | Manifest-driven action tiles — click **Execute** to run governed intents |
| **Health Monitor** | Click **Run Health Check** to verify the backend is reachable |

---

## Sign Out

Click **Sign out** in the top-right corner. Your session tokens are revoked server-side and cookies are cleared.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Not signed in" after login | Hard-refresh the page (`Cmd+Shift+R` / `Ctrl+Shift+R`). Ensure your browser allows third-party cookies or has `pj.publiclogic.org` and `publiclogic-puddlejumper.fly.dev` allowed. |
| OAuth error page | Check that pop-up/redirect blockers aren't interfering. Try a different provider. |
| Health check fails | The backend may be cold-starting on Fly.io — wait 5–10 seconds and retry. |
| Tiles not appearing | Tiles are populated from the server manifest. If you have no permissions, no tiles will show. Contact your admin. |
