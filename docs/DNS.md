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
