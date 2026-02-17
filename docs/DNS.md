# DNS Configuration for publiclogic.org

Domain registrar: **GoDaddy** (nameservers: ns11/ns12.domaincontrol.com)

## Current DNS Records

| Type  | Name | Value                                      | TTL    | Purpose               |
|-------|------|--------------------------------------------|--------|------------------------|
| A     | @    | 216.150.1.1                                | 600s   | Root domain            |
| CNAME | pj   | cname.vercel-dns.com.                      | 1 Hour | Frontend → Vercel ✅   |
| CNAME | api  | publiclogic-puddlejumper.fly.dev.          | 1 Hour | Backend → Fly.io ✅    |
| CNAME | www  | cname.vercel-dns.com.                      | 1 Hour | WWW → Vercel ✅        |

## Verifying DNS

```bash
dig pj.publiclogic.org +short
# Expected: cname.vercel-dns.com. followed by Vercel Anycast IPs
```

## Architecture

```
pj.publiclogic.org  ──→  Vercel (Next.js frontend)
api.publiclogic.org ──→  Fly.io (PuddleJumper backend)
www.publiclogic.org ──→  Vercel
```

## Required Fly.io Secrets for Authentication

The backend (Fly.io) needs these environment variables set for OAuth to work
with the frontend (Vercel). Set them with `flyctl secrets set`:

```bash
flyctl secrets set -a publiclogic-puddlejumper \
  FRONTEND_URL=https://pj.publiclogic.org \
  PJ_UI_URL=https://pj.publiclogic.org \
  CORS_ALLOWED_ORIGINS=https://pj.publiclogic.org \
  PJ_ALLOWED_PARENT_ORIGINS=https://pj.publiclogic.org \
  COOKIE_DOMAIN=.publiclogic.org
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `FRONTEND_URL` | `https://pj.publiclogic.org` | Backend knows the frontend origin |
| `PJ_UI_URL` | `https://pj.publiclogic.org` | OAuth callback redirects here after auth |
| `CORS_ALLOWED_ORIGINS` | `https://pj.publiclogic.org` | Backend accepts API calls from frontend |
| `PJ_ALLOWED_PARENT_ORIGINS` | `https://pj.publiclogic.org` | Trusted parent origin for embedding |
| `COOKIE_DOMAIN` | `.publiclogic.org` | Session cookies shared across subdomains |

### Required Vercel Environment Variable

Set in Vercel → Project Settings → Environment Variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api.publiclogic.org` | Frontend API calls go to the backend |
