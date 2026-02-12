# PublicLogic Portal — Powered by Tenebrux Veritas

Internal deployment engine for VAULT governance installs into municipal Microsoft 365 tenants.

## TL;DR Operation

1. Start the console: `npm run dev`
2. Sign in with operator credentials.
3. Open **Environments** and select a town.
4. Update **Deployment Context** and save it.
5. Select modules, generate **Governance Diff**.
6. Acknowledge warnings, type `deploy <town-name>`, then deploy.
7. In **Remote Command Center**, verify readiness and run GitHub publish.
8. In **Deploy Remote Actions**, create SharePoint folder/document/page.
9. In **Folder + Document Proof**, create a proof folder and proof document.
10. Use **PL Quick Launch** for GitHub and SharePoint verification checks.
11. Add continuity notes in **Veritas Memory**.

No client-facing updates are made here. This is internal only.

Human-readable operator runbook:

- `docs/HUMANITY_RUN.md`

## What Lives Where

- `client/`:
  - Operator UI (React + Vite)
  - Branding and workflow shell for Tenebrux Veritas
- `server/`:
  - Auth/session handling
  - Existing legacy deploy flow (`/run`, `/governance-diff`, etc.)
  - New Tenebrux API (`/veritas/*`)
- `data/`:
  - `environments.json`: municipal environment registry
  - `vault-canon.json`: authoritative Foundations + Workspaces
  - `deployment-contexts/*.json`: per-environment deployment context
  - `connections/*.json`: connection references (no plaintext secrets)
  - `veritas-memory.jsonl`: institutional memory
  - `deploy-log.jsonl`: audit log

## Runtime and Build

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

- Client: `http://127.0.0.1:5174/hmlp/`
- Server API: `http://127.0.0.1:3001`

Build:

```bash
npm run build
npm run start
```

## Remote Control Setup (GitHub + SharePoint)

Use this when you want Tenebrux Veritas to run both remotes directly.

1. Set Graph credentials in `.env` (or shell env):
   - `TV_GRAPH_TENANT_ID`
   - `TV_GRAPH_CLIENT_ID`
   - `TV_GRAPH_CLIENT_SECRET`
2. In environment `Connection Reference`, set:
   - `tenantIdRef`: `env://TV_GRAPH_TENANT_ID`
   - `clientIdRef`: `env://TV_GRAPH_CLIENT_ID`
   - `keychainRef`: `env://TV_GRAPH_CLIENT_SECRET`
   - `graphEnabled`: checked
3. In environment `Deployment Context`, set `SharePoint Site URL` (for example `https://publiclogic978.sharepoint.com/sites/PL`).
4. In `Deploy Remote Actions`:
   - `Deploy Active Target to GitHub` publishes the current target file via your deploy script.
   - `Create SharePoint Folder`, `Create SharePoint Document`, and `Create SharePoint Page` execute directly through Microsoft Graph.

If SharePoint is not ready, `Deploy Remote Actions` shows exactly which field is missing.

## API Surface (Tenebrux)

- Environments
  - `GET /veritas/environments`
  - `GET /veritas/environments/:id`
  - `POST /veritas/environments`
  - `PUT /veritas/environments/:id`
  - `DELETE /veritas/environments/:id` (soft archive)
- Deployment Context
  - `GET /veritas/environments/:id/context`
  - `PUT /veritas/environments/:id/context`
- Connection References
  - `GET /veritas/environments/:id/connection`
  - `PUT /veritas/environments/:id/connection`
- Canon
  - `GET /veritas/canon`
- Governance Diff
  - `POST /veritas/governance-diff`
- Deploy
  - `POST /veritas/deploy`
- Memory
  - `GET /veritas/memory`
  - `GET /veritas/memory/:envId`
  - `POST /veritas/memory`
- Audit
  - `GET /veritas/audit`
  - `GET /veritas/audit/:envId`
- Filesystem Proof
  - `GET /veritas/proof/:envId`
  - `POST /veritas/proof/folder`
  - `POST /veritas/proof/document`
- Remote Deploy Controls
  - `GET /veritas/remote/:envId/status`
  - `POST /veritas/remote/github/deploy`
  - `POST /veritas/remote/sharepoint/folder`
  - `POST /veritas/remote/sharepoint/document`
  - `POST /veritas/remote/sharepoint/page`

## Hard Stops Enforced

Deployment is blocked when any of these are true:

- Workspace selected before Foundations are complete.
- Deployment context checklist is incomplete.
- Governance diff is stale/missing or has blockers.
- Warnings are not acknowledged.
- Confirmation phrase is incorrect.

## Security Rules

- Do not store plaintext secrets in repository files.
- Connection records accept references only (`env://...`, `keychain://...`).
- Session auth remains server-side.
- Audit remains append-only with hash chaining.

## Existing Flow Compatibility

Legacy routes and behavior remain available:

- `/login`, `/logout`, `/repos`, `/target`, `/content`, `/run`, `/audit`, `/veritas-memory`

Tenebrux routes were added without removing prior operator capabilities.
