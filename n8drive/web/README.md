This is the **PublicLogic Control Center** — the internal launcher and front door for the PublicLogic platform. Built with [Next.js](https://nextjs.org).

## Getting Started

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Launcher Environment Variables

The home page launcher reads the following env vars to build app cards. If a var is missing, the card shows as "Not configured" (no broken link).

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PL_URL_MAIN` | PublicLogic main web app |
| `NEXT_PUBLIC_PL_URL_PJ` | PuddleJumper workspace |
| `NEXT_PUBLIC_PL_URL_PJ_ADMIN` | PuddleJumper admin console |
| `NEXT_PUBLIC_PL_URL_PJ_GUIDE` | PuddleJumper Quick Start guide |
| `NEXT_PUBLIC_PL_URL_OS` | PublicLogic OS (HMLP) surface |
| `NEXT_PUBLIC_PL_URL_DEPLOY_CONSOLE` | Deploy console (optional) |
| `NEXT_PUBLIC_PL_URL_CHAMBER_CONNECT` | Chamber Connect (optional) |

Copy `.env.local.example` or set these in your `.env.local`.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
