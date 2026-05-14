## PJ Governance Checklist

- [ ] No `innerHTML` used in PJ UI files.
- [ ] No CSP weakening (no `unsafe-inline`, no unapproved third-party script hosts).
- [ ] No demo fallback logic added to production runtime paths.
- [ ] All new PJ actions route through `/api/pj/execute`.
- [ ] Capability gating respected (no role-string-only assumptions).
- [ ] Tenant containment preserved on all new reads/writes.
- [ ] Correlation IDs surfaced in execution/error paths.
- [ ] Tests added or updated for changed behavior.
