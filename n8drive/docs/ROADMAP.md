## PuddleJumper – Next Phases

These phases focus on the most impactful, near-term improvements observed in the current codebase and open issues.

### Phase 1 – Stabilize Deployments
- Fix Fly.io staging volume permissions (SQLite CANTOPEN) to regain staging parity before further feature work.
- Align Docker build with workspace defaults (all package.json copied before install; ensure PRR/connector DB defaults are present).

### Phase 2 – PRR Testability & Data Layer
- Refactor PRR routes/stores to accept injected DB handles instead of opening file-based connections. This will unblock PRR API/store unit tests and enable in-memory testing.
- Add migration ordering/fixtures to avoid foreign key issues during tests.

### Phase 3 – Contract Compliance
- Investigate and resolve pj-contract failures (CSP meta tags + /api/pj endpoints). Confirm baseline on main and update expectations or implementation accordingly.

### Phase 4 – Repo Hygiene
- Remove committed secrets/artifacts (.env.production, .DS_Store, zero-byte placeholders), standardize on pnpm (drop npm lockfiles), and add LICENSE and root README.
- Consolidate duplicate workspace files (e.g., pnpm-workspace.n) and extend .gitignore for env/db/test artifacts.

### Phase 5 – Security & Observability
- Enforce consistent path validation defaults for DB locations across environments.
- Add minimal smoke checks (health, PRR endpoints) to CI and staging to detect regressions early.

### Phase 6 – Frontend/UX Readiness
- Run axe/keyboard sweeps on PRR/admin flows; capture snapshots for regressions.
- Document staging/prod URLs and smoke procedures alongside the existing deployment guide.
