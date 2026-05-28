# Workspace — Copilot Instructions

## What This Repo Is

Workspace is the React/Vite SPA frontend for the PublicLogic platform. It is a **pure frontend** — no server, no API routes, no backend code. All data access goes through PuddleJumper (the backend).

**Live URLs:**
- Frontend: https://workspace-rho.vercel.app (also aliased to os.publiclogic.org once DNS is set)
- Backend: https://api.publiclogic.org (PuddleJumper on Fly.io)

**Companion repo:** `~/puddlejumper` — the PuddleJumper backend. Read its `docs/SYSTEMS-MAP.md` for the big picture.

---

## Repo Layout

```
src/
├── App.tsx                 # Root — auth gate, tool routing, global state
├── main.tsx                # Entry point — wraps <AuthProvider>
├── components/             # Shared UI (LoginPage, Toolbar, panels...)
├── features/               # Feature modules (m365/, google/, admin/, ...)
│   ├── m365/components/    # M365Manager, M365TestPanel
│   ├── google/components/  # GoogleTestPanel
│   ├── connections/        # ConnectionsDialog (the active one)
│   └── logicbackend/       # API endpoint builder tool
├── services/
│   ├── auth/AuthContext.tsx # THE auth provider — useAuth() hook
│   ├── pjApi.ts            # THE API client — all provider calls go here
│   ├── microsoftPJService.ts  # Microsoft Graph via PJ proxy
│   └── googlePJService.ts     # Google APIs via PJ proxy
├── hooks/                  # Custom React hooks
└── lib/                    # Types, utils
```

---

## Auth Model

**Single source of truth: PuddleJumper session cookie.**

- `useAuth()` from `src/services/auth/AuthContext.tsx` — provides `user`, `loading`, `login(provider)`, `logout()`
- `login(provider)` redirects to `{PJ}/api/auth/{provider}/login` — PJ handles the full OAuth flow
- After OAuth completes, PJ redirects back to Workspace with `?auth=success`
- `AuthContext` calls `/api/me` on PJ to hydrate the user session
- App.tsx gates render: loading spinner → LoginPage → app

**Never** redirect to an OAuth provider directly from Workspace. Always go through PuddleJumper.

---

## API Client — `pjApi.ts`

**All external provider calls must use `pjApi`.**

```ts
import { pjApi } from '@/services/pjApi'

// GitHub (hits api.github.com via PJ)
const repos = await pjApi.github.get('user/repos')

// Microsoft Graph (hits graph.microsoft.com/v1.0/* via PJ)
const me = await pjApi.microsoft.get('me')
const files = await pjApi.microsoft.get('me/drive/root/children')

// Google APIs (hits www.googleapis.com/* via PJ)
const files = await pjApi.google.get('drive/v3/files')
const msgs = await pjApi.google.get('gmail/v1/users/me/messages')

// Connect a provider (redirects user through PJ connector OAuth)
await pjApi.connectors.connect('microsoft')
await pjApi.connectors.connect('google')
```

All requests use `credentials: 'include'` — the PJ session cookie carries auth. PJ looks up the stored connector token server-side and injects it into the upstream request. **Tokens never reach the browser.**

The env var `VITE_PJ_API_URL` controls the PJ base URL:
- Dev: `http://localhost:3002`
- Prod: `https://api.publiclogic.org`

---

## Provider Service Classes

High-level wrappers over `pjApi`:

| Class | File | Proxies to |
|-------|------|-----------|
| `MicrosoftPJService` | `src/services/microsoftPJService.ts` | `pjApi.microsoft.*` |
| `GooglePJService` | `src/services/googlePJService.ts` | `pjApi.google.*` |

These match the method signatures of the old browser-direct service classes. Use them in components that need structured API calls. No `connection` parameter — PJ session handles auth.

---

## PuddleJumper Proxy Routes

| PJ Route | Upstream | Used for |
|----------|----------|---------|
| `/api/github/*` | `api.github.com` | GitHub API |
| `/api/microsoft/*` | `graph.microsoft.com/v1.0/*` | Microsoft Graph |
| `/api/google/*` | `www.googleapis.com/*` | Google APIs |
| `/api/google/upload/*` | `upload.googleapis.com/*` | Google Drive file uploads |

---

## State Management

Global state lives in `useKV` hooks in `App.tsx` (backed by `@github/spark/hooks`, which persists to localStorage). Key stores:
- `logicworkspace-files` — file items
- `logicworkspace-connections` — legacy connection objects (kept for backwards compat)
- `logicworkspace-automations`, `logicworkspace-templates`, etc.

The `connections` state is legacy — connectors are now managed server-side in PuddleJumper's `ConnectorStore`. The UI for connecting/disconnecting providers should call `pjApi.connectors.*`.

---

## Development

```bash
# Install
npm install

# Dev server (needs PJ running locally or set VITE_PJ_API_URL to prod)
npm run dev

# Build
npm run build

# Preview production build
npm run preview
```

**Local PuddleJumper:**
```bash
cd ~/puddlejumper/n8drive
pnpm --filter puddlejumper dev
# PJ runs on localhost:3002
```

---

## Deployment

Deployed to Vercel automatically. Manual deploy:
```bash
vercel --prod
```

Vercel project: `workspace` (team: `publiclogic`)  
`vercel.json` configures `outputDirectory: dist` and SPA rewrite (`/* → /index.html`).

---

## Key Constraints

1. **No direct provider API calls from the browser** — always use `pjApi.*`
2. **No tokens in localStorage or sessionStorage** — PJ session cookie is the only auth
3. **No new legacy service files** — `microsoft365.ts`, `google.ts`, and the `api/` services were deleted; do not recreate them
4. **CORS** — PJ's `CORS_ALLOWED_ORIGINS` must include the Vercel preview URL for new deployments
5. **OAuth callback URLs** — changing the Vercel project URL requires updating `LOGIC_COMMONS_URL` Fly secret on PuddleJumper

---

## Common Pitfalls

- **"Authentication required" on `/api/me`** — session cookie missing or expired; user needs to log in again
- **"Microsoft not connected" / "Google not connected"** — user hasn't gone through the connector OAuth flow yet; call `pjApi.connectors.connect(provider)`
- **CORS errors in dev** — set `VITE_PJ_API_URL=http://localhost:3002` and ensure PJ has `CORS_ALLOWED_ORIGINS=http://localhost:5173`
- **GitHub login not auto-connecting GitHub connector** — the `onTokenExchanged` hook in PJ `server.ts` handles this; check PJ logs
