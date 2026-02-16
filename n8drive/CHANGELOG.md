# Changelog

All notable changes to PuddleJumper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-16

### Added
- **Multi-tenant workspace collaboration**
  - Role-based access control (Owner/Admin/Member/Viewer)
  - Email invitation system with token-based acceptance
  - Auto-accept invitations on OAuth login
  - Member management UI in Admin panel

- **Tier management system**
  - Free tier: 3 templates, 50 approvals/month, 1 member
  - Pro tier: Unlimited resources
  - Usage tracking with visual progress bars
  - Admin upgrade flow with plan selection modal
  - Color-coded usage states (normal/near-limit/at-limit)

- **Admin UI enhancements**
  - Members tab with invitation management
  - Usage card showing workspace limits and current usage
  - Upgrade modal with plan descriptions
  - Toast notifications for success/error states
  - Mobile-responsive design

- **Test coverage**
  - 507 total tests (73 logic-commons + 434 puddlejumper)
  - E2E smoke tests with Playwright
  - Visual snapshot tests for VS review
  - Accessibility testing with axe-core

- **Documentation**
  - V1 release documentation
  - Admin upgrade instructions
  - Known limitations and roadmap

### Changed
- Extracted inline CSS to external files for better caching
- Simplified CSP to use `style-src 'self'` instead of hash-based validation
- Improved error handling in OAuth flows
- Enhanced session persistence and refresh token handling

### Fixed
- CSS not applying due to CSP hash mismatch
- HTML body content accidentally deleted during CSS extraction
- JavaScript breaking in onclick handlers due to HTML escaping
- Member count atomicity in concurrent operations

### Security
- Content Security Policy headers enforced
- CSRF token validation on state-changing operations
- Session token rotation on refresh
- Workspace isolation in all API endpoints

## [0.9.0] - 2026-02-14

### Added
- Initial governance engine with approval workflows
- Chain templates for multi-step approvals
- Governed webhook dispatch with retry logic
- Multi-provider OAuth (GitHub, Google, Microsoft)
- SQLite database with workspace isolation
- Metrics and operational dashboard

### Known Issues in V1.0.0
- Email invitations show copy-link only (actual email sending not implemented)
- Plan upgrades are manual admin operations (no billing integration)
- Single workspace per user (multi-workspace planned for V1.1)
- No workspace ownership transfer
- Audit log UI not available (events logged but not viewable)

---

[1.0.0]: https://github.com/97n8/puddlejumper/releases/tag/v1.0.0
[0.9.0]: https://github.com/97n8/puddlejumper/releases/tag/v0.9.0
