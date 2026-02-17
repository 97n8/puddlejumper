# PublicLogic Web (Control Center)

This app is the internal PublicLogic launcher and operator surface.

## Run locally

```bash
cd n8drive/web
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Launcher configuration

`src/lib/portalApps.ts` builds app cards from `NEXT_PUBLIC_*` env vars.

Required/primary:
- `NEXT_PUBLIC_PL_URL_MAIN`
- `NEXT_PUBLIC_PL_URL_PJ`
- `NEXT_PUBLIC_PL_URL_PJ_ADMIN`
- `NEXT_PUBLIC_PL_URL_PJ_GUIDE`
- `NEXT_PUBLIC_PL_URL_OS`

Optional:
- `NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE`
- `NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT`

If a URL is missing, the card is shown as **Not configured** and stays disabled.

## Notes

- The page keeps the launcher at the top and PJ runtime/auth/health blocks below it.
- This app is internal-first; optional systems can remain unconfigured.
