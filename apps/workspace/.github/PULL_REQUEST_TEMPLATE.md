## Summary
<!-- What does this PR do? Link any related issues. -->

## Changes
<!-- Bullet list of the notable changes. -->

## Workspace architecture checklist
- [ ] No direct provider API calls from the browser — all traffic goes through `pjApi`
- [ ] No tokens stored in `localStorage` / `sessionStorage`
- [ ] No new legacy service files (`microsoft365.ts`, `google.ts`, etc.) recreated
- [ ] If adding a `useKV` key, considered the migration story for existing users

## Verification
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

## Screenshots / notes
<!-- UI screenshots, deploy preview link, follow-up issues, etc. -->
