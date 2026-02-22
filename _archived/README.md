# Archived Projects

This directory marks projects that are no longer under active development.
They are preserved here for reference only — no bug fixes, no new features.

## chamber-connect

**Chamber of Commerce case management prototype**

A JSON-server prototype for routing constituent inquiries through a Chamber of Commerce intake system. Built for the early PublicLogic / Logicville concept.

- **Status**: Archived — no CI, no tests, stale npm dependencies, no active development
- **Superseded by**: PuddleJumper (`n8drive/`) which handles multi-tenant governance workflows generically
- **Last seen in git**: commit `f270d62` — recover files with `git show f270d62:chamber-connect/<file>`

The full source history is preserved in git. To browse the code:
```bash
git log --all -- chamber-connect/
git show f270d62 -- chamber-connect/server.js
```

## portal-signin.html

Standalone portal sign-in prototype. Superseded by the production version at
`n8drive/apps/puddlejumper/public/portal-signin.html` (which follows CSP best
practices with external stylesheets and scripts).

## logo-background-removed.png

PuddleJumper logo asset (previously at repo root with a space in the filename).
Not referenced by any code or documentation.
