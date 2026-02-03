# PublicLogic OS Deployment

This OS is designed to be hosted as a private web app.

Recommended target:
- `https://os.publiclogic.org/` (separate site from the public marketing site)
- Or (your requested entry path): `https://www.publiclogic.org/HMLP/`

## Option A (Recommended): Deploy as os.publiclogic.org on Netlify
1. Create a new Netlify site
2. Deploy the `publiclogic-os-ui/` folder
3. Add custom domain: `os.publiclogic.org`
4. Update `config.js`:
   - `msal.redirectUri` = `https://os.publiclogic.org/`
   - `msal.postLogoutRedirectUri` = `https://os.publiclogic.org/`
5. In Entra ID app registration, ensure `https://os.publiclogic.org/` is a SPA redirect URI

Why this is best:
- Keeps the public site clean
- Keeps the OS easy to lock down and iterate

## Option B: Host Under www.publiclogic.org/HMLP/
This is possible, but you will need the marketing site deploy pipeline to include a `/HMLP/` folder (or a rewrite).

If you do it:
- URL: `https://www.publiclogic.org/HMLP/`
- Update `config.js` redirect URIs accordingly
- Ensure the OS files live in the `/HMLP/` directory on the deployed site

Netlify routing (so /HMLP doesn't get swallowed by your marketing SPA fallback):
```
/HMLP/*  /HMLP/index.html  200
/*      /index.html        200
```

Important: security headers
- If you deploy the OS as its own Netlify site: you can use the `_headers` file as-is.
- If you merge the OS into the same Netlify site as the marketing pages: scope your headers to `/HMLP/*` so you don't break the public site.

Alternative (common): redirect the path to the subdomain
- Keep the OS deployed at `https://os.publiclogic.org/`
- Add a redirect on the marketing site so `https://www.publiclogic.org/HMLP` forwards to `https://os.publiclogic.org/`

Netlify redirect example (on the marketing site):
```\n/HMLP/*  https://os.publiclogic.org/:splat  302!\n```

## Netlify Security Headers (Recommended)
This repo includes a `_headers` file for basic hardening.

## Quick Smoke Test
After deploy:
1. Visit the OS URL
2. Sign in with Microsoft 365
3. Go to `Settings` and run `Connection Checks`
4. Confirm:
   - Tasks list loads
   - Pipeline list loads
   - Projects list loads
   - Today page shows your calendar
