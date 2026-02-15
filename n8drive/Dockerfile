# ---------- BUILDER ----------
FROM node:20 AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ build-essential libsqlite3-dev ca-certificates \
  && ln -s /usr/bin/python3 /usr/bin/python || true \
  && rm -rf /var/lib/apt/lists/*

COPY . .

RUN corepack enable
RUN corepack prepare pnpm@8.15.8 --activate
ENV CI=true

RUN pnpm install --frozen-lockfile

# Root build — produces /app/dist/api/server.js (and auth.js, etc.)
RUN pnpm run build

# Rebuild native addons for linux target
RUN pnpm rebuild better-sqlite3

# Prune dev deps (keeps runtime deps + native .node binaries)
RUN pnpm --filter @publiclogic/puddlejumper deploy --prod /prod

# ---------- RUNTIME ----------
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu libsqlite3-0 \
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
