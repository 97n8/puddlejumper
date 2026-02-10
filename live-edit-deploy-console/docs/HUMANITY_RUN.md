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

## 4. Publish chain (GitHub + Preview)

Use the `GitHub + Preview` card in Active Workspace.

1. `Open AGNOSTIC` to update source.
2. `Open Public_Logic` to trigger release bridge.
3. `Open Vercel Deployments` to confirm build status.
4. Validate with:
   - `Open Public Site`
   - `Open OS Home`
   - `Open Selected Live`

## 5. If deployment is blocked

The system blocks for safety. Read the first blocker and fix in this order:

1. Missing context fields.
2. Missing checklist confirmations.
3. Missing foundations/dependencies.
4. Stale governance diff (regenerate).
5. Confirm phrase mismatch.

Do not bypass blockers by changing live pages directly.

## 6. Fast troubleshooting

- If UI is blank: rebuild and restart.
  ```bash
  npm run build
  npm run dev
  ```
- If already running and ports conflict: stop old process on `3001`/`5174`, then rerun.
- If auth fails: check session, then retry sign-in with operator account.

## 7. Definition of done

A deployment is done only when all are true:

- Deploy action succeeded in Tenebrux Veritas.
- Live municipal URL shows expected behavior.
- Continuity note is written.
- Audit entry exists for the action.
