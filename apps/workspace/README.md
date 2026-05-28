# Workspace

**Operational software for modern public-sector teams.** Workspace combines governed workspaces, document tooling, integrations, demos, and builders in one frontend connected to PuddleJumper.

## Features

- **Environments** 🏛️: Demo and operational workspaces for municipalities, teams, and projects
- **LogicDocs** 📄: Create and stage governed documents with templates and cloud sync
- **Vault** 🔐: Governed storage and records workflows
- **Automations** ⚡: Workflow automation for Microsoft 365, Google Workspace, and GitHub
- **LogicCommons** 🌐: GitHub-backed template and repository workflows
- **Module Builder** 🧩: Create reusable governance modules and workspace structures
- **LogicBackend** 🔧: Browse and test backend endpoints from the frontend
- **Cloud Integrations** ☁️: Native Microsoft 365, Google Drive, and GitHub integration

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Modern browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

### Setup Cloud Integrations (Optional)

Cloud integrations are optional but unlock powerful automation features. See detailed setup instructions below.

## Project Structure

```
src/
├── App.tsx                    # Root — auth gate, tool routing
├── main.tsx                   # Entry — wraps <AuthProvider>
├── components/                # Shared UI
│   ├── ui/                    # Shadcn components (45+ pre-installed)
│   ├── LoginPage.tsx
│   ├── PuddleJumper.tsx
│   ├── Toolbar.tsx
│   └── ...
├── features/                  # ~40 lazy-loaded panels organized by domain
│   ├── admin/                 # User management & workspace admin
│   ├── budgeting/             # Municipal budgeting
│   ├── connections/           # Connector OAuth dialogs
│   ├── environments/          # Environment hub + workspace shells
│   ├── flows/                 # Synchron8 automations
│   ├── intake/, evidence/, records/, procurement/, …
│   ├── logiccommons/          # GitHub-backed templates
│   ├── logicbridge/, logicdash/, govai/, comms/
│   ├── puddles/               # Puddles AI chat
│   ├── m365/, vault/, town/, settings/, start/
│   └── (run `ls src/features` for the full list)
├── services/
│   ├── auth/                  # AuthContext + useAuth() — PJ session
│   ├── pjApi.ts               # Single API client — all provider calls
│   ├── microsoftPJService.ts  # Microsoft Graph via PJ proxy
│   ├── googlePJService.ts     # Google APIs via PJ proxy
│   └── pj/                    # Typed PJ data layer
├── hooks/                     # useKV, useMobileMode, useConnectorStatus, …
├── lib/                       # types, utils, logger, environmentAccess, …
└── test/                      # Vitest specs

api/                           # Vercel serverless routes (Puddles, health, …)
public/                        # Static assets shipped with the build
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full architecture and
[`.github/copilot-instructions.md`](.github/copilot-instructions.md) for
day-to-day contributor guidance.



## Technology Stack

- **React 19** with TypeScript
- **Vite** for blazing-fast development
- **Tailwind CSS** with custom design system
- **Shadcn UI** components (v4)
- **Framer Motion** for animations
- **Spark KV** for persistent storage
- **Phosphor Icons** for iconography
- **Sonner** for toast notifications

### Cloud APIs

- **Microsoft Graph API** (OneDrive, SharePoint)
- **Google Drive API** (file storage)
- **GitHub REST API** (repository management)

## Deployment

### Manual deploy (one-off)

```bash
./deploy.sh              # frontend only  → Vercel
./deploy.sh --all        # frontend + backend → Vercel + Fly.io
./deploy.sh --backend    # PuddleJumper only → Fly.io
```

### Automatic deploy (CI/CD)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app and deploys it to Vercel. The deployment is recorded under the **Environments → production** tab of this repository.

**Required repository secrets** (Settings → Secrets and variables → Actions):

| Secret | How to get it |
|--------|--------------|
| `VERCEL_TOKEN` | Vercel dashboard → Account → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after running `vercel link`, or Vercel team settings |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after running `vercel link` |

> **Tip:** run `vercel link` once locally — it creates `.vercel/project.json` containing both IDs.

## Development

### Commands

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

### Key Concepts

**Persistent Storage**: Use `useKV` hook for data that survives page reloads

```typescript
import { useKV } from '@/hooks/useKV'

const [files, setFiles] = useKV<FileItem[]>('my-files', [])

// Always use functional updates
setFiles(current => [...current, newFile])
```

**Cloud Integration — PuddleJumper proxy model**

All provider calls (Microsoft 365, Google, GitHub) go through the PuddleJumper backend.
Tokens are held server-side — **never in the browser**. Auth is carried by a session cookie.

```typescript
import { pjApi } from '@/services/pjApi'

// Connect a provider (redirects user through PJ OAuth flow)
await pjApi.connectors.connect('microsoft')
await pjApi.connectors.connect('google')

// Microsoft Graph (via PJ proxy → graph.microsoft.com/v1.0/*)
const me = await pjApi.microsoft.get('me')
const files = await pjApi.microsoft.get('me/drive/root/children')

// Google APIs (via PJ proxy → googleapis.com/*)
const driveFiles = await pjApi.google.get('drive/v3/files')
const messages = await pjApi.google.get('gmail/v1/users/me/messages')

// GitHub (via PJ proxy → api.github.com/*)
const repos = await pjApi.github.get('user/repos')
```

High-level typed wrappers are available in `src/services/microsoftPJService.ts` and
`src/services/googlePJService.ts` for components that need structured method calls.

## Cloud Integration Setup

### Microsoft 365 (OneDrive, SharePoint, Outlook, Teams)

No Azure app registration required. PuddleJumper owns the OAuth credentials.

1. Start the dev server: `npm run dev`
2. Click the avatar menu → **Connections**
3. Click **Connect Microsoft 365** — this redirects through PuddleJumper's OAuth flow
4. After consent, PuddleJumper stores the token server-side; the session cookie carries auth
5. Microsoft Graph features unlock automatically

> **Local dev:** set `VITE_PJ_API_URL=http://localhost:3002` and ensure PuddleJumper is running
> with `CORS_ALLOWED_ORIGINS=http://localhost:5173`

### Google Workspace (Drive, Gmail, Calendar)

Same flow as Microsoft — no `VITE_GOOGLE_CLIENT_ID` needed.

1. Click the avatar menu → **Connections**
2. Click **Connect Google** — PuddleJumper handles the OAuth redirect
3. Google APIs become available via `pjApi.google.*`

### GitHub

1. Click the avatar menu → **Connections**
2. Click **Connect GitHub** — PuddleJumper handles the OAuth flow
3. Repositories load automatically in LogicCommons and Files & Connections

## Membership Tiers & Feature Gates

### Free Tier
- All core tools (LogicPen, LogicDocs, DocDump, LogicCommons)
- 3 active automations
- 1 CaseSpace
- Community templates (read-only)
- Basic cloud storage connections

### Pro Tier ($9/month)
- Everything in Free
- 20 active automations
- 10 CaseSpaces
- Template publishing to marketplace
- Priority automation execution
- Advanced analytics

### Team Tier ($29/month)
- Everything in Pro
- Unlimited automations
- Unlimited CaseSpaces
- Team collaboration features
- Admin panel with user management
- Custom branding
- Dedicated support

## Documentation

- **[PRD.md](./PRD.md)**: Product requirements and design decisions
- **[SECURITY.md](./SECURITY.md)**: Security guidelines and best practices

## Contributing

1. Follow the existing code structure and patterns
2. Use TypeScript for all new code
3. Follow Tailwind-first styling approach
4. Always use `pjApi.*` for provider calls — never call provider APIs directly from the browser
5. Update documentation for major changes

## Design System

- **Colors**: Emerald green primary (oklch(0.65 0.18 155)), Teal accent (oklch(0.45 0.12 160))
- **Fonts**: Bricolage Grotesque (display), Inter (UI), JetBrains Mono (code)
- **Spacing**: Consistent Tailwind scale with generous breathing room
- **Border Radius**: 0.875rem (14px) default, creating softer edges
- **Components**: Shadcn v4 with custom green theme
- **Animations**: Subtle, purposeful transitions with Framer Motion
- **Philosophy**: Approachable, fluid, and refined - welcoming to all users

## Security

- Provider OAuth tokens held server-side in PuddleJumper — never reach the browser
- Session cookie (HTTP-only, Secure, SameSite=Lax) carries auth; no tokens in localStorage
- CSRF protection via PJ's `pjFetch` client
- HTTPS required in production

## License

Copyright (c) 2025–2026 PublicLogic, Inc. All rights reserved.

This software is **proprietary and confidential**. Unauthorized copying, modification, distribution, or use of this software, in whole or in part, is strictly prohibited. See the [LICENSE](LICENSE) file for details.

For licensing inquiries: info@publiclogic.org

## Support

For issues, questions, or feature requests, please refer to the documentation files or create an issue in the repository.
