# ---------- BUILDER ----------
FROM node:20-bookworm AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ build-essential libsqlite3-dev ca-certificates \
  && ln -s /usr/bin/python3 /usr/bin/python || true \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable
RUN corepack prepare pnpm@8.15.8 --activate

# Copy package manifests first for better layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/puddlejumper/package.json apps/puddlejumper/
COPY apps/logic-commons/package.json apps/logic-commons/
COPY packages/core/package.json packages/core/
COPY web/package.json web/

ENV CI=true
RUN pnpm install --frozen-lockfile

# Now copy source (changes here won't bust the install cache)
COPY . .

# Clean stale TypeScript build cache (prevents composite build issues)
RUN find . -name "*.tsbuildinfo" -type f -delete

# Build packages in explicit dependency order (same as CI)
RUN pnpm --filter @publiclogic/core run build && \
    pnpm --filter @publiclogic/logic-commons run build && \
    pnpm --filter @publiclogic/puddlejumper run build

# Rebuild native addons for linux target
RUN pnpm rebuild better-sqlite3

# Prune dev deps (keeps runtime deps + native .node binaries)
RUN pnpm --filter @publiclogic/puddlejumper deploy --prod /prod

# ---------- RUNTIME ----------
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu libsqlite3-0 sqlite3 \
  && rm -rf /var/lib/apt/lists/*

# Copy deployment bundle produced by pnpm deploy
COPY --from=builder /prod /app
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/api/server.js"]
