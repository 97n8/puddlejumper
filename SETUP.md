# Bring PuddleJumper Live Local

## Prerequisites

```bash
node -v   # Need 20+
pnpm -v   # Need 9+. If missing: npm install -g pnpm
```

## 1. Unzip and enter

```bash
unzip puddlejumper-final.zip
cd puddlejumper
```

## 2. Fix what the scaffold is missing

The zip is architecturally correct but won't compile yet. These files need to exist:

### PostCSS config (Tailwind v4 won't work without it)

```bash
cat > apps/web/postcss.config.mjs << 'EOF'
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
EOF
```

### Next.js middleware (protects /dashboard and /admin)

```bash
cat > apps/web/middleware.ts << 'EOF'
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // TODO: Replace with real auth check (cookie, JWT, etc.)
  // For now, allow everything in dev
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // In production, redirect unauthenticated users to login
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    // Check for session cookie here
    // const session = request.cookies.get("pj-session");
    // if (!session) {
    //   return NextResponse.redirect(new URL("/login", request.url));
    // }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
EOF
```

### API tsconfig

```bash
cat > apps/api/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

### Puddles placeholder (so turbo doesn't error)

```bash
cat > apps/puddles/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "jsx": "preserve", "noEmit": true },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
EOF

cat > apps/puddles/app/page.tsx << 'EOF'
export default function PuddlesPage() {
  return <div>Puddles — assists, never decides.</div>;
}
EOF
```

### Core package tsconfig

```bash
cat > packages/core/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
```

### DB package tsconfig

```bash
cat > packages/db/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
```

### Formkey tsconfig

```bash
cat > packages/formkey/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
```

## 3. Environment

```bash
cp .env.example .env.local
```

You don't need to fill in anything for local dev except optionally the Anthropic key (for Puddles later).

## 4. Install

```bash
pnpm install
```

This will take a minute. better-sqlite3 compiles native bindings. If it fails on a Mac, you may need:

```bash
xcode-select --install   # If you haven't already
```

On Windows, you need windows-build-tools or Visual Studio Build Tools.

## 5. Create the data directory

```bash
mkdir -p apps/api/data
```

SQLite will create the .db file on first run. The data/ directory is gitignored.

## 6. Run it

### Everything at once:

```bash
pnpm dev
```

This starts turbo in parallel:
- `apps/web` on http://localhost:3000 (the site + dashboard)
- `apps/api` on http://localhost:3001 (Express backend)

### Just the web app:

```bash
pnpm --filter @pj/web dev
```

### Just the API:

```bash
pnpm --filter @pj/api dev
```

## 7. Verify

- http://localhost:3000 → Homepage (hero, GPR explanation, product suite, deployments, CTA)
- http://localhost:3000/product → PuddleJumper product page
- http://localhost:3000/pricing → Pricing page
- http://localhost:3000/docs → Documentation landing
- http://localhost:3000/about → PublicLogic story
- http://localhost:3000/formkey → Formkey page
- http://localhost:3000/login → Sign in page
- http://localhost:3000/dashboard → Dashboard (sidebar layout)
- http://localhost:3000/admin → Admin panel
- http://localhost:3001/api/health → Should return:

```json
{
  "status": "ok",
  "runtime": "puddlejumper-gpr",
  "version": "0.1.0-pre",
  "timestamp": "..."
}
```

## 8. Run the release gate

```bash
chmod +x scripts/ship.sh
pnpm ship
```

First run will check:
- No "wren" in codebase
- No @vercel/kv imports
- TypeScript compiles
- Build succeeds
- Audit triggers present in schema

## What you're looking at

The pages are scaffolded — they have layouts, metadata, and component slots but the components are mostly comment blocks describing what goes there. The architecture is live: route groups split marketing from platform, tenant types flow through packages, VAULT evaluation types are importable, the audit schema with triggers is real.

## Next steps to fill it out (in order)

1. **Hero component** — replace the comment blocks in `apps/web/components/marketing/hero.tsx` with actual JSX. The copy is already written in the component file.

2. **Seed the database** — write a seed script that creates a dev tenant, a test user, and a couple sample flows:
```bash
cat > apps/api/db/seed.ts << 'SEED'
import { getDb, migrate } from "@pj/db";
const db = getDb("./data/pj.db");
migrate(db);
// Insert dev tenant, test user, sample flows
SEED
```

3. **Wire auth** — pick a provider (Auth.js is simplest for Next.js + Microsoft SSO) and replace the middleware placeholder.

4. **Build the first real flow** — take the Phillipston PRR workflow, model it as a GovernanceFlow with FlowSteps, wire VAULT evaluation. That's the demo.

5. **Add the duck** — drop the logo files into `apps/web/public/images/` and update the site header and hero.

## If something breaks

```bash
# Nuclear reset
rm -rf node_modules apps/*/node_modules packages/*/node_modules .turbo
pnpm install

# Check what turbo sees
pnpm turbo build --dry-run

# Run just typecheck to find errors
pnpm turbo typecheck
```
