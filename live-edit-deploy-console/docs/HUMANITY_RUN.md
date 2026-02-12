# Tenebrux Veritas Humanity Run

This is the plain-language operating run for PublicLogic operators.

## 1. Start the system

```bash
cd "/Users/n8/Documents/New project/live-edit-deploy-console"
npm run dev
```

Open:

- Console: `http://127.0.0.1:5174/hmlp/`
- API health: `http://127.0.0.1:3001/health`

## 2. Understand the two layers

- `Active Workspace` row in Tenebrux Veritas = **control record** (where you configure and deploy).
- Live municipal environment URL = **what the town sees** (monitor here, do not edit directly).
- Live URLs are now set per environment using `Live Environment URL` in Environment details.

## 3. Standard operator cycle

1. Select the municipality row on the left.
2. Open `Live Environment Monitor` and confirm current live behavior.
3. Update deployment context in Tenebrux Veritas.
4. Save context.
5. Generate governance diff.
6. Read warnings, acknowledge each one.
7. Type confirm phrase exactly: `deploy <town-name>`.
8. Deploy.
9. Re-open live environment and verify result.
10. Record what changed in continuity memory.

## 4. PL Quick Launch

Use `PL Quick Launch` in Active Workspace.

1. Open the repo you need (`AGNOSTIC`, `Public_Logic`, or `CASE Workspace`).
2. Open SharePoint filesystem targets (`Tenant Site`, `Documents`, `Site Contents`).
3. Open `Tenant Admin` when permission or structure checks are needed.
4. Open `Vercel` and live URLs to verify publication.

If environment tenant fields are empty, the launchpad defaults to `publiclogic978.sharepoint.com`.

## 5. Deploy folders and documents (proof flow)

This proves Tenebrux Veritas can create real filesystem artifacts for the selected environment.

1. Open `Active Workspace`.
2. Select the municipal row.
3. In `Remote Command Center`, confirm readiness and run:
   - `Deploy Active Target to GitHub`
4. In `Deploy Remote`, confirm:
   - Repository
   - Branch
   - Target File
   - Origin Remote
5. In `Folder + Document Proof`, set:
   - `Folder Name` (example: `oakham-proof-2026-02-10`)
   - `Document Name` (example: `proof-note.md`)
   - Optional content
6. Click `Create Proof Folder`.
7. Click `Create Proof Document`.
8. Confirm new rows appear in the proof table and audit panel.
9. Confirm files exist on disk under:
   - `/Users/n8/Documents/New project/live-edit-deploy-console/data/proof-system/<env-id>/`

## 6. Deploy remote actions (real GitHub + SharePoint)

This is the production-style control surface.

1. Select the environment row.
2. Confirm `Deploy Remote` shows the correct repo/branch/file/origin.
3. Open `Deploy Remote Actions`.
4. Check readiness badges:
   - `GitHub remote: ready`
   - `SharePoint remote: ready`
5. Run GitHub publish:
   - Click `Deploy Active Target to GitHub`
6. Run SharePoint operations:
   - Set `SharePoint Library` and `Folder Path`
   - Click `Create SharePoint Folder`
   - Set `Document Name`/`Document Content`, click `Create SharePoint Document`
   - Set `Page Title`/`Page Name`, click `Create SharePoint Page`
7. Confirm result appears in:
   - `Last remote action` block
   - audit entries (`remote:github_deploy`, `remote:sharepoint_*`)

Required SharePoint connection refs in environment settings:
- `tenantIdRef`: `env://TV_GRAPH_TENANT_ID`
- `clientIdRef`: `env://TV_GRAPH_CLIENT_ID`
- `keychainRef`: `env://TV_GRAPH_CLIENT_SECRET`
- `graphEnabled`: true

## 7. If deployment is blocked

The system blocks for safety. Read the first blocker and fix in this order:

1. Missing context fields.
2. Missing checklist confirmations.
3. Missing foundations/dependencies.
4. Stale governance diff (regenerate).
5. Confirm phrase mismatch.

Do not bypass blockers by changing live pages directly.

## 8. Fast troubleshooting

- If UI is blank: rebuild and restart.
  ```bash
  npm run build
  npm run dev
  ```
- If already running and ports conflict: stop old process on `3001`/`5174`, then rerun.
- If auth fails: check session, then retry sign-in with operator account.

## 9. Definition of done

A deployment is done only when all are true:

- Deploy action succeeded in Tenebrux Veritas.
- Live municipal URL shows expected behavior.
- Continuity note is written.
- Audit entry exists for the action.
