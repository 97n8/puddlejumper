# Standalone Vault deployment (simplified)
FROM node:20-alpine

WORKDIR /app

# Install pnpm and native build toolchain.
# better-sqlite3 needs python/make/g++ to compile its node binding when the
# prebuilt musl binary isn't picked up under pnpm's nested layout.
RUN corepack enable pnpm \
    && apk add --no-cache python3 make g++ libc6-compat

# Copy package files
COPY package.json ./

# Install dependencies (production only). Force a rebuild of native modules
# so better_sqlite3.node lands in node_modules even if the prebuild step
# was skipped or downloaded the wrong arch.
RUN pnpm install --prod \
    && pnpm rebuild better-sqlite3

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
