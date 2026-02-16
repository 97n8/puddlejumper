# Test Directory Structure

The PuddleJumper monorepo uses a dual test directory structure:

## Directory Organization

### `/n8drive/test/` - Legacy Unit Tests
Contains older unit tests and integration tests that were written before the monorepo refactoring.

**Contents:**
- `governance.test.ts` - Governance/approval workflow tests
- `idempotency-store.test.ts` - Idempotency tracking tests  
- `pj-popout.test.ts` - Popout window tests
- `server.test.ts` - Server integration tests
- `sqlite-maintenance.test.ts` - SQLite maintenance utility tests
- `tests/runtime.spec.ts` - Runtime configuration tests (nested legacy)

**Note:** This directory is kept for backward compatibility. New tests should go in package-specific test directories.

### `/n8drive/tests/` - E2E and Visual Regression Tests
Contains Playwright-based end-to-end tests and visual snapshot tests added in V1.

**Contents:**
- `e2e/` - End-to-end user flow tests
  - `prr-e2e.spec.ts` - PRR submission and workflow tests
  - `smoke.spec.ts` - Basic smoke tests
- `e2e-smoke.spec.ts` - Additional smoke tests
- `login.spec.ts` - Authentication flow tests
- `snapshots/` - Visual regression tests
  - `visual.spec.ts` - Playwright visual snapshots

### Package-Specific Test Directories
Each package has its own `/test/` directory for unit tests:

- `/n8drive/packages/core/test/` - Core utilities unit tests
- `/n8drive/apps/logic-commons/test/` - Logic Commons unit tests
- `/n8drive/apps/puddlejumper/test/` - PuddleJumper app unit tests
  - Contains 428 passing tests (27 test files)
  - 2 stubbed PRR tests (documented in `prr.api.test.skip.txt`)

## Test Commands

```bash
# Run all unit tests
cd n8drive
pnpm --filter @publiclogic/puddlejumper run test

# Run E2E tests
cd n8drive
pnpm run test:e2e

# Run visual regression tests
cd n8drive
pnpm run test:visual
```

## Rationale

**Why two top-level test directories?**

1. **Historical:** `/test/` existed before monorepo refactoring
2. **Separation of Concerns:** 
   - `/test/` = Legacy integration tests (vitest)
   - `/tests/` = E2E and visual tests (playwright)
   - Package-specific `/test/` = New unit tests (vitest)
3. **Build Tools:** Different test runners (vitest vs playwright) work better with separate directories

## Future Consolidation

For V2+, consider consolidating to:
- Move `/test/` contents to `/apps/puddlejumper/test/` (unit tests)
- Keep `/tests/` for E2E/visual (different test runner)
- Remove nested `/test/tests/` (legacy artifact)

This is tracked as part of ongoing repo hygiene but is not critical for V1 functionality.
