# PuddleJumper V1 Release

## Version 1.0.0

### Overview
PuddleJumper V1 is a multi-tenant governance control plane that provides governed approval workflows, workspace collaboration, and tier-based resource limits.

### V1 Scope & Features

**Core Governance Engine:**
- ✅ Approval queue with pending/approved/rejected/expired states
- ✅ Chain templates for multi-step workflows
- ✅ Governed webhook dispatch with retry logic
- ✅ Metrics and operational dashboard
- ✅ CAS (Compare-And-Swap) conflict resolution

**Workspace Collaboration:**
- ✅ Multi-user workspaces with role-based access (Owner/Admin/Member/Viewer)
- ✅ Email invitations with token-based acceptance
- ✅ Auto-accept invitations on OAuth login
- ✅ Member management UI (add/remove/change roles)

**Tier Management:**
- ✅ Free tier: 3 templates, 50 approvals/mo, 1 member
- ✅ Pro tier: Unlimited resources
- ✅ Usage tracking and visual progress bars
- ✅ Admin upgrade flow with plan selection
- ✅ Tier enforcement on create operations

**Authentication & Security:**
- ✅ Multi-provider OAuth (GitHub, Google, Microsoft)
- ✅ Session management with refresh tokens
- ✅ CSRF protection
- ✅ Workspace isolation
- ✅ Content Security Policy headers

**UI/UX:**
- ✅ Admin dashboard with tabs (Queue, Templates, Dashboard, Members)
- ✅ Usage card with color-coded progress bars
- ✅ Upgrade modal with plan descriptions
- ✅ Invitation management UI
- ✅ Mobile-responsive design
- ✅ Accessible keyboard navigation

### Admin Upgrade Instructions

**For Workspace Owners:**
1. Navigate to **Admin** → **Members** tab
2. Review current usage in the **Usage Card**
3. Click **⬆️ Upgrade** button
4. Select plan (Free or Pro)
5. Confirm upgrade
6. New limits apply immediately

**Note:** Plan changes are currently admin-only and manual. Billing integration is planned for a future release.

### Architecture

**Monorepo Structure:**
- `packages/core` - Shared types and auth middleware
- `apps/logic-commons` - OAuth/session library (73 tests)
- `apps/puddlejumper` - Main governance engine (434 tests)

**Deployment:**
- **Production:** https://pj.publiclogic.org (Fly.io)
- **CI/CD:** GitHub Actions auto-deploy on push to main
- **Build time:** ~90-120 seconds

**Database:**
- SQLite (production: persistent volume on Fly.io)
- Tables: workspaces, approvals, templates, chains, members, invitations, sessions, refresh_tokens

### Known Limitations & Follow-Ups

**V1 Limitations:**
1. **No billing integration** - Plan upgrades are manual admin operations
2. **Email not sent** - Invitations show copy-link UI; actual email sending is TODO
3. **Single workspace per user** - Users get one workspace on first login
4. **No workspace transfer** - Cannot transfer ownership to another user
5. **No audit log UI** - Audit events logged but no UI to view them

**Planned for V1.1+:**
- [ ] Stripe billing integration
- [ ] Email delivery via SendGrid/Postmark
- [ ] Multi-workspace support
- [ ] Workspace transfer
- [ ] Audit log viewer UI
- [ ] Slack/Teams notification integrations
- [ ] Export approvals to CSV/JSON
- [ ] API rate limiting
- [ ] Webhook signature verification

### Testing

**Test Coverage:**
- **Total:** 507 tests passing
  - logic-commons: 73 tests
  - puddlejumper: 434 tests
- **Types:** Unit, integration, E2E smoke tests
- **A11Y:** axe-core checks on Admin and submission pages
- **Visual:** Playwright snapshots for VS review

**Run tests:**
```bash
pnpm -r test                  # All unit + integration tests
npx playwright test           # E2E smoke tests
npx playwright test --update-snapshots  # Update visual snapshots
```

### Security

**Audit Status (V1):**
- Moderate vulnerabilities: 2 (dev dependencies: esbuild, path-to-regexp)
- High/Critical: 1 (dev-only, documented mitigation below)
- Production dependencies: ✅ Clean

**Mitigations:**
- `esbuild` and `path-to-regexp` are dev dependencies only (not shipped to production)
- Vite/Vitest vulnerabilities affect local dev server, not production build
- Monitoring for updates; will patch in V1.1

### Deployment Checklist

Before deploying V1 to production:
- [x] All 507 tests passing
- [x] Build succeeds (`pnpm -r build`)
- [x] No critical security vulnerabilities in prod deps
- [x] Visual snapshots approved by VS team
- [x] A11Y checks passing (no critical issues)
- [ ] VS team sign-off: **REQUIRED**
- [ ] Security team sign-off
- [ ] Staging deployment verified
- [ ] E2E smoke tests passing on staging

### Versioning & Changelog

See `CHANGELOG.md` for detailed version history.

**V1.0.0 Highlights:**
- Initial production release
- Multi-tenant workspace collaboration
- Tier-based resource limits
- Admin usage & upgrade UI
- 507 tests passing

---

**Questions or issues?** Open an issue at https://github.com/97n8/puddlejumper/issues
