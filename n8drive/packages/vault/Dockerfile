# Standalone Vault deployment (simplified)
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy package files
COPY package.json ./

# Install dependencies (production only)
RUN pnpm install --prod

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
