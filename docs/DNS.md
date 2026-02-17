# DNS Configuration for publiclogic.org

Domain registrar: **GoDaddy** (nameservers: ns11/ns12.domaincontrol.com)

## Required DNS Records

| Type  | Name | Value                                      | TTL    | Purpose               |
|-------|------|--------------------------------------------|--------|------------------------|
| A     | @    | 216.150.1.1                                | 600s   | Root domain            |
| A     | pj   | 76.76.21.21                                | 600s   | Frontend → Vercel      |
| CNAME | api  | publiclogic-puddlejumper.fly.dev.          | 1 Hour | Backend → Fly.io       |
| CNAME | www  | cname.vercel-dns.com.                      | 1 Hour | WWW → Vercel           |

## Fixing the `pj` Subdomain

GoDaddy does not allow adding a CNAME when an A record already exists for the
same name. To point `pj.publiclogic.org` at Vercel:

1. **Delete** the existing A record for `pj` (currently `66.241.125.172`).
2. **Add** a new A record:
   - Type: `A`
   - Name: `pj`
   - Value: `76.76.21.21`
   - TTL: 600 seconds

Alternatively, after deleting the A record you can add a CNAME instead:
   - Type: `CNAME`
   - Name: `pj`
   - Value: `cname.vercel-dns.com.`
   - TTL: 1 Hour

Either option routes `pj.publiclogic.org` to the Vercel deployment.

> **Note:** `76.76.21.21` is Vercel's Anycast IP. Using an A record is simpler
> on GoDaddy since it avoids the A-vs-CNAME conflict. A CNAME is technically
> preferred (handles Vercel IP changes automatically) but requires deleting the
> A record first.

## Verifying DNS

After making the change, confirm propagation:

```bash
dig pj.publiclogic.org +short
# Expected: 76.76.21.21   (A record)
# or:       cname.vercel-dns.com. → 76.76.21.21   (CNAME)
```

Propagation typically completes within 10 minutes (600s TTL).

## Architecture

```
pj.publiclogic.org  ──→  Vercel (Next.js frontend)
api.publiclogic.org ──→  Fly.io (PuddleJumper backend)
www.publiclogic.org ──→  Vercel
```
