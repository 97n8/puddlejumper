# GitHub Copilot Instructions

This document provides guidance for GitHub Copilot when working with the PuddleJumper repository.

## Repository Overview

PuddleJumper is a multi-tenant governance engine for municipal decision workflows, part of the PublicLogic ecosystem. The repository contains multiple projects in a monorepo structure:

- **n8drive/**: Core PuddleJumper application (pnpm monorepo with TypeScript/Express backend and Next.js frontend)
- **chamber-connect/**: Chamber of Commerce case management prototype
- **live-edit-deploy-console/**: Municipal M365 tenant deployment engine
- **publiclogic-operating-system/**: PublicLogic OS playbooks (canonical source)
- **publiclogic-os-ui/**: PublicLogic OS frontend (vanilla JS static app)
- **publiclogic-site/**: Marketing/public site

## Tech Stack

### Backend (n8drive/)
- **Language**: TypeScript 5.7+
- **Runtime**: Node.js 20.x
- **Framework**: Express 4.x
- **Database**: SQLite with better-sqlite3
- **Package Manager**: pnpm 8.15.8 (use corepack)
- **Monorepo**: pnpm workspaces (defined in `n8drive/pnpm-workspace.yaml`)
- **Testing**: Vitest
- **Build**: TypeScript compiler (tsc)

### Frontend (n8drive/web/)
- **Framework**: Next.js 16.x
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x
- **Package Manager**: npm (NOT pnpm - has its own package-lock.json)
- **Design System**: Geist font, Tailwind zinc/emerald color palette

### Packages Structure
```
n8drive/
  ├── apps/
  │   ├── puddlejumper/     # Main backend app
  │   └── logic-commons/    # OAuth/auth service
  ├── packages/
  │   ├── core/             # Shared utilities
  │   └── vault/            # Policy/audit layer (planned)
  └── web/                  # Next.js frontend
```

## Development Workflow

### Getting Started
```bash
# Backend development
cd n8drive
pnpm install
pnpm run dev              # Start PuddleJumper server

# Frontend development
cd n8drive/web
npm ci                    # Use npm, NOT pnpm
npm run dev              # Start Next.js dev server

# Run tests
cd n8drive
pnpm run test            # Run all tests
pnpm run test:pj         # Run PuddleJumper tests only
```

### Build Commands
```bash
cd n8drive
pnpm run build           # Build all packages
pnpm run build:pj        # Build PuddleJumper only
pnpm run build:web       # Build Next.js frontend

# Frontend TypeScript check
cd n8drive/web
npm ci
./node_modules/.bin/tsc --noEmit
```

### Testing Commands
```bash
cd n8drive
pnpm run test           # Run all tests
pnpm run test:core      # Test core package
pnpm run test:pj        # Test PuddleJumper

# Known test failures: 6 pre-existing failures in vaultContract, config-validation, oauthStateStore
# Only fix test failures related to your changes
```

## Coding Standards

### TypeScript
- **Strict Mode**: Use strict TypeScript settings
- **No `any`**: Avoid using `any` type; use proper typing
- **Type Imports**: Use `type` keyword for type-only imports
- **Module System**: Use ES modules (`type: "module"` in package.json)

### Authentication & Security
- **JWT**: Minimum 32-character JWT_SECRET (enforced by Zod validation)
- **Cookies**: HttpOnly, SameSite=Lax for session cookies
- **CSRF Protection**: All mutating API requests require `X-PuddleJumper-Request: true` header
- **CSP**: Strict Content Security Policy - NO inline scripts or styles
  - `script-src 'self'`
  - `style-src 'self' https://fonts.googleapis.com`
  - All HTML pages must use external CSS/JS files
  - Use CSS classes instead of inline style attributes
- **Authorization**: Check user roles (`admin` vs regular user) for protected routes
- **Token Extraction**: Cookie first, then `Authorization: Bearer` header

### Database (SQLite)
- **Durability Pragmas**: All SQLite stores must use:
  ```sql
  journal_mode = WAL
  synchronous = NORMAL
  wal_autocheckpoint = 1000
  ```
- **Store Pattern**: Use better-sqlite3 for synchronous operations
- **Transactions**: Use transactions for multi-statement operations

### API Design
- **Response Format**: Wrap JSON responses as:
  ```typescript
  {
    success: boolean,
    correlationId: string,
    data: ...
  }
  ```
- **CSRF**: Mutating methods (POST, PUT, PATCH, DELETE) require CSRF header
- **Safe Methods**: GET, HEAD, OPTIONS are exempt from CSRF
- **Error Handling**: Return appropriate HTTP status codes (401, 403, 500)

### CSS/Styling
- **Design System**: Use consistent CSS variables across all backend HTML:
  ```css
  --bg: #09090b
  --surface: #18181b
  --border: #27272a
  --accent: #10b981 (emerald)
  --radius: 12px
  ```
- **Frontend**: Use Tailwind CSS with zinc/emerald palette
- **No Inline Styles**: Due to CSP, use external CSS files only

### Naming Conventions
- **Files**: kebab-case for file names (e.g., `approval-store.ts`)
- **Functions**: camelCase
- **Classes**: PascalCase
- **Constants**: UPPER_SNAKE_CASE for environment variables

## File Organization

### Backend Routes
- Routes are in `n8drive/apps/puddlejumper/src/api/routes/`
- Server configuration in `n8drive/apps/puddlejumper/src/api/server.ts`
- Middleware in `n8drive/apps/puddlejumper/src/api/serverMiddleware.ts`

### Frontend Pages
- Pages in `n8drive/web/src/app/` following Next.js App Router structure
- Protected pages use `RequireAuth` wrapper
- API calls use `pjFetch` wrapper (automatically adds CSRF header)

### Public Assets
- Backend HTML/CSS/JS in `n8drive/apps/puddlejumper/public/`
- Styles: `public/styles/pj.css`, `pj-admin.css`, `pj-guide.css`, `pj-signin.css`
- Scripts: `public/scripts/`

## Testing Practices

### Test Structure
- 473 total tests across the monorepo
- 6 known pre-existing failures (not your responsibility to fix)
- Use Vitest for backend tests
- Use supertest for API endpoint testing
- Follow existing test patterns in the repository

### Running Tests
- Run tests before making changes to understand baseline
- Run targeted tests during development
- Only fix test failures related to your changes
- Full test suite: `pnpm run test` from n8drive/ directory

## Security Requirements

### Authentication
- Built-in `/api/login` requires `ALLOW_ADMIN_LOGIN=true` and `NODE_ENV !== production`
- OAuth supported: Google, GitHub, Microsoft
- JWT tokens must validate: exp, iss, aud
- Support both RS256 (JWT_PUBLIC_KEY) and HS256 (JWT_SECRET)

### CSRF Protection
- Implemented in `@publiclogic/core` (`csrfProtection()`)
- Required on all mutating API methods
- Missing marker returns 403

### Authorization
- Check user roles for protected routes
- Admin-only routes must verify `role === "admin"`
- Return 401 for unauthenticated, 403 for unauthorized

### Sensitive Data
- Never commit secrets to source code
- Use environment variables for credentials
- Cookie domain is optional (COOKIE_DOMAIN env var)

## Important Conventions

### Package Manager Usage
- **Backend (n8drive/)**: Use pnpm (via corepack enable)
- **Frontend (n8drive/web/)**: Use npm (has separate package-lock.json)
- Never mix package managers in the same directory

### Monorepo Structure
- Workspace authority: `n8drive/pnpm-workspace.yaml`
- Workspace dependencies: Use `workspace:*` protocol
- Ignored built dependencies: better-sqlite3, esbuild

### Playbook Synchronization
- Three directories must stay in sync:
  - `publiclogic-operating-system/` (canonical source)
  - `publiclogic-os-ui/content/playbooks/`
  - `publiclogic-site/HMLP/content/playbooks/`
- Use `./scripts/sync-playbooks.sh` to sync
- CI checks for drift with `--check` flag

### Health Checks
- `/health`: Deep check (DB, volume, secrets)
- `/ready`: Lightweight check (DB ping only)
- Fly.io uses `/health` endpoint
- Keep `min_machines_running=1` to prevent cold starts

## Deployment

### Supported Platforms
- **Fly.io**: Containerized deployment (preferred for production)
- **Vercel**: Serverless deployment
- **Docker**: Standard container deployment

### Environment Variables
- Required: JWT_SECRET, AUTH_ISSUER, AUTH_AUDIENCE
- Database paths: PRR_DB_PATH, CONNECTOR_DB_PATH
- URLs: PJ_PUBLIC_URL, BASE_URL
- OAuth: Provider-specific client IDs and secrets

## Documentation

### Key Documents
- `n8drive/README.md`: Main PuddleJumper documentation
- `n8drive/docs/`: Architecture and user guides
- `n8drive/ops/ARCHITECTURE-NORTH-STAR.md`: Strategic roadmap
- `n8drive/SECURITY.md`: Security model and policies
- `n8drive/ops/DISASTER-RECOVERY.md`: DR procedures (RTO ≤30min, RPO ≤6h)
- `n8drive/ops/OPERATIONAL-HANDOFF.md`: Operations documentation

### Documentation Updates
- Update docs when making significant changes
- Keep README.md files current
- Security changes require SECURITY.md updates

## Special Notes

### Architecture Pattern
PuddleJumper is a control plane for municipal governance:
- **Fail-closed governance**: Actions denied by default
- **Dispatch isolation**: Separates decision, execution, authority
- **Operational visibility**: Full audit trail of all actions

### Frontend Integration
- Frontend consumes ~25 of 30+ backend APIs
- Some endpoints not yet integrated (invitations, plan updates, chain template creation)
- Check `n8drive/docs/FRONTEND_INTEGRATION_PLAN.md` for status

### Operational Readiness
- 3-tier readiness model: Alpha → Pilot → Production
- See `n8drive/ops/MUNICIPAL-READINESS.md` for criteria
- Monitoring via Prometheus/Grafana

## Making Changes

### Minimal Changes Philosophy
- Make the smallest possible changes to achieve the goal
- Don't fix unrelated bugs or broken tests
- Don't remove working code unless necessary
- Preserve existing behavior unless specifically changing it

### Before Committing
1. Run linters if they exist
2. Run relevant tests
3. Check that builds succeed
4. Verify changes work as expected
5. Review security implications

### Git Workflow
- Work in feature branches
- Write clear commit messages
- Keep commits focused and atomic
- Don't commit build artifacts (node_modules, dist, etc.)

## Resources

- Main Repo: https://github.com/97n8/puddlejumper
- PublicLogic: https://publiclogic.org
- Documentation: See n8drive/docs/ directory
- Operations: See n8drive/ops/ directory
