# PublicLogic Site

Netlify deploy target for [publiclogic.org](https://publiclogic.org).

## What's here

| Path | Purpose |
|------|---------|
| `index.html` | Root landing page — embeds the main PublicLogic portal via iframe |
| `HMLP/` | Mirror of **publiclogic-os-ui** for the `/HMLP` route on Netlify |
| `_headers` | Netlify security headers for the HMLP sub-app |
| `_redirects` | Netlify routing rules (SPA fallback for HMLP) |

## Playbook sync

The `HMLP/content/playbooks/` directory is kept in sync with the canonical
source in `publiclogic-operating-system/`. Run:

```bash
./scripts/sync-playbooks.sh          # copy canonical → all mirrors
./scripts/sync-playbooks.sh --check  # CI drift check (exits 1 if out of sync)
```

See the root README for details.
