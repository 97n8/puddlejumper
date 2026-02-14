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
RUN pnpm run build
RUN pnpm rebuild better-sqlite3
RUN pnpm --filter @publiclogic/puddlejumper deploy --prod /prod

# ---------- RUNTIME ----------
FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libsqlite3-0 gosu \
     && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

COPY --from=builder /prod /app

ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/api/server.js"]
