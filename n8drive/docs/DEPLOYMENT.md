# Deployment Guide

This guide covers deploying PuddleJumper to various cloud platforms.

## Prerequisites

- Node.js 20+
- pnpm
- Docker (for Fly.io)
- Vercel CLI (for Vercel)
- Fly.io CLI (for Fly.io)

## Environment Variables

Copy `.env.sample` to `.env` and configure the following required variables:

```bash
# Authentication
JWT_SECRET=your-256-bit-secret-here
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api

# Database paths (use absolute paths in production)
PRR_DB_PATH=/app/data/prr.db
CONNECTOR_DB_PATH=/app/data/connectors.db

# URLs
PJ_PUBLIC_URL=https://your-domain.com
BASE_URL=https://your-domain.com

# OAuth (configure based on your OAuth providers)
# See logic-commons OAuth setup for GitHub, Google, Microsoft
```

## Vercel Deployment

### Setup

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Link your project:
   ```bash
   cd apps/puddlejumper
   vercel link
   ```

### Deploy

```bash
# From project root
./scripts/deploy-vercel.sh
```

Or manually:
```bash
pnpm run build
cd apps/puddlejumper
vercel --prod
```

### Vercel Configuration

The `apps/puddlejumper/vercel.json` configures:
- Serverless function for API routes
- Static file serving for public assets
- 60-second timeout for long-running operations
- 1GB memory allocation

## Fly.io Deployment

### Setup

1. Install Fly.io CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

3. Initialize the app (if not already done):
   ```bash
   fly launch
   ```

### Deploy

```bash
# From project root
./scripts/deploy-fly.sh
```

Or manually:
```bash
pnpm run build
fly deploy
```

### Fly.io Configuration

The `fly.toml` configures:
- Docker-based deployment
- Persistent volume for SQLite databases
- Health checks on `/health` endpoint
- Auto-scaling with min 0, max based on load
- 1 CPU, 1GB RAM shared instance

## Docker Deployment

### Build Locally

```bash
docker build -t puddle-jumper .
```

### Run Locally

```bash
docker run -p 3002:3002 \
  -e JWT_SECRET=your-secret \
  -e AUTH_ISSUER=puddle-jumper \
  -e AUTH_AUDIENCE=puddle-jumper-api \
  -e PRR_DB_PATH=/app/data/prr.db \
  -e CONNECTOR_DB_PATH=/app/data/connectors.db \
  -v $(pwd)/data:/app/data \
  puddle-jumper
```

## Production Considerations

### Database Persistence

- **Fly.io**: Uses persistent volumes (`pj_data`)
- **Vercel**: Use Vercel Postgres or external database
- **Docker**: Mount host volume to `/app/data`

### Environment Variables

Set these in your deployment platform:

```bash
NODE_ENV=production
JWT_SECRET=your-production-secret
AUTH_ISSUER=your-issuer
AUTH_AUDIENCE=your-audience
PJ_PUBLIC_URL=https://your-domain.com
```

### OAuth Configuration

Configure OAuth providers in your deployment environment:
- GitHub OAuth App
- Google OAuth credentials
- Microsoft Azure AD app

### Health Monitoring

- Health endpoint: `GET /health`
- Metrics endpoint: `GET /metrics` (Prometheus format)
- Logs available in deployment platform dashboards

## Troubleshooting

### Vercel Issues

- Check function logs: `vercel logs`
- Ensure all dependencies are in `package.json`
- Verify `vercel.json` paths are correct

### Fly.io Issues

- Check app logs: `fly logs`
- Verify volume mounting: `fly volumes list`
- Check health: `fly checks list`

### Common Issues

1. **Database permissions**: Ensure data directory is writable
2. **OAuth redirects**: Configure correct callback URLs
3. **CORS issues**: Update `CORS_ALLOWED_ORIGINS` for your domain
4. **Memory limits**: Monitor usage and adjust instance sizes