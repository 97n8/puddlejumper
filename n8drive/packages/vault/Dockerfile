# Standalone Vault deployment.
#
# We use Debian (bookworm-slim) instead of Alpine because better-sqlite3's
# prebuilt binaries are glibc-based and consistently resolve here without
# native compilation. Alpine + pnpm + native modules has well-known issues
# where the .node binding ends up missing in the nested pnpm layout.
FROM node:20-bookworm-slim

WORKDIR /app

# pnpm + build tools (build tools only fire if the prebuilt download fails;
# usually they're a no-op for better-sqlite3 on glibc).
RUN corepack enable pnpm \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./

# Install dependencies (production only). Run lifecycle scripts so
# better-sqlite3's prebuild-install grabs the native binding.
RUN pnpm install --prod \
    && pnpm rebuild better-sqlite3 \
    && node -e "require('better-sqlite3'); console.log('better-sqlite3 native binding OK')"

# Copy source code and data
COPY src ./src
COPY data ./data
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm add -D typescript tsx
RUN pnpm run build

# Create data directories for SQLite
RUN mkdir -p /app/data/db

# Expose Vault HTTP port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3003/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run server
CMD ["node", "dist/server.js"]
