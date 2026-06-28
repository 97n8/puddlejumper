# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in LogicOS or any PublicLogic system,
please report it responsibly by emailing:

**info@publiclogic.org**

Do not open a public GitHub issue for security vulnerabilities.

We will acknowledge your report within 48 hours and aim to resolve confirmed
vulnerabilities within 30 days. We appreciate responsible disclosure.

## Scope

This policy covers the LogicOS frontend and its integration with the
PuddleJumper backend (api.publiclogic.org).

  * The location of the affected source code (tag/branch/commit or direct URL)
  * Any special configuration required to reproduce the issue
  * Step-by-step instructions to reproduce the issue
  * Proof-of-concept or exploit code (if possible)
  * Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Policy

See [GitHub's Safe Harbor Policy](https://docs.github.com/en/site-policy/security-policies/github-bug-bounty-program-legal-safe-harbor#1-safe-harbor-terms)

---

## Security Architecture

### Authentication & Sessions
- All authentication is handled server-side via PuddleJumper (api.publiclogic.org)
- Session state is carried by an `HttpOnly`, `Secure`, `SameSite=Lax` cookie — never a token in localStorage
- OAuth flows (GitHub, Microsoft, Google) go through PuddleJumper only; tokens never reach the browser
- TLS 1.2+ enforced in transit; HSTS with 2-year max-age including subdomains

### Access Control
- Every tool is gated by `canUseTool()` server-verified role checks (owner / admin / member / viewer)
- Admin-only tools (Admin panel, Syncronate, FormKey) require `admin` or `owner` role
- Demo-restricted users are limited to `casespaces` only
- AccessGate shown for any tool a user lacks permission for — no silent redirect

### Content Security Policy
- `default-src 'self'` — no unexpected resource loads
- `connect-src` locked to: api.publiclogic.org, GitHub, Google APIs, Microsoft/Azure AD, SharePoint
- `frame-ancestors` limits embedding to same-origin, SharePoint, and Microsoft Online portals
- `upgrade-insecure-requests` enforced — all mixed content blocked

### Code Execution Sandbox (LogicCode)
- User code runs in a sandboxed `<iframe sandbox="allow-scripts allow-forms">` — no `allow-same-origin`
- `postMessage` uses `window.location.origin` target — not wildcard `*`
- Message listeners validate `e.origin` before processing

### Municipal IT Compatibility
- No tokens or PII stored in localStorage or sessionStorage
- Works behind Zscaler / Cisco Umbrella SSL inspection (no certificate pinning)
- Compatible with Azure AD Conditional Access — OAuth goes through Microsoft's standard flow
- `X-Frame-Options: SAMEORIGIN` permits embedding in municipal SharePoint/intranet portals
- `frame-ancestors` explicitly allows `*.sharepoint.com` and `*.microsoftonline.com`
- Compliant with MA public records law requirements for audit trail and retention
- TLS 1.2+ only; no HTTP resources loaded

### Microsoft Graph Scopes (Minimum Necessary)
| Scope | Purpose |
|-------|---------|
| `User.Read` | Read signed-in user's profile |
| `Files.ReadWrite` | User's own OneDrive files only (not `Files.ReadWrite.All`) |
| `Sites.Read.All` | Read SharePoint sites the user has access to |
| `Mail.Send` | Send mail on behalf of signed-in user only |
| `Calendars.ReadWrite` | User's calendar |
| `Tasks.ReadWrite` | User's To-Do tasks |
| `Team.ReadBasic.All` | Teams the user is a member of |
| `offline_access` | Maintain session |

