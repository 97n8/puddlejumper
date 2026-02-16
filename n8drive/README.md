# PuddleJumper

Multi-tenant governance engine for decision workflows. Secure, scalable, and built for the enterprise.

## Features

- **Workspace Isolation**: Each user gets their own secure workspace with complete data isolation
- **Approval Chains**: Multi-step approval workflows with parallel processing and audit trails
- **Governance Engine**: Policy-driven decision making with comprehensive audit logging
- **OAuth Integration**: Support for GitHub, Google, and Microsoft OAuth providers
- **Role-Based Access**: Admin and viewer roles with appropriate permissions
- **API-First Design**: RESTful APIs for integration with existing systems

## Quick Start

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd puddle-jumper-deploy-remote
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.sample .env
   # Edit .env with your configuration
   ```

3. **Start development server:**
   ```bash
   pnpm run dev
   ```

4. **Open your browser:**
   - Landing page: http://localhost:3002/pj
   - Admin panel: http://localhost:3002/pj/admin
   - Health check: http://localhost:3002/health

### Production Deployment

#### Vercel (Serverless)

1. **Install Vercel CLI and login:**
   ```bash
   npm install -g vercel
   vercel login
   ```

2. **Deploy:**
   ```bash
   pnpm run deploy:vercel
   ```

#### Fly.io (Containerized)

1. **Install Fly.io CLI and login:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Deploy:**
   ```bash
   pnpm run deploy:fly
   ```

#### Docker

```bash
docker build -t puddle-jumper .
docker run -p 3002:3002 \
  -e JWT_SECRET=your-secret \
  -e AUTH_ISSUER=puddle-jumper \
  -e AUTH_AUDIENCE=puddle-jumper-api \
  puddle-jumper
```

## Configuration

### Required Environment Variables

```bash
# Authentication
JWT_SECRET=your-256-bit-secret-here
AUTH_ISSUER=puddle-jumper
AUTH_AUDIENCE=puddle-jumper-api

# Database paths
PRR_DB_PATH=./data/prr.db
CONNECTOR_DB_PATH=./data/connectors.db

# URLs
PJ_PUBLIC_URL=https://your-domain.com
BASE_URL=https://your-domain.com
```

### OAuth Setup

Configure OAuth providers in your environment:

- **GitHub**: Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`
- **Google**: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Microsoft**: Set `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`

## API Documentation

### Core Endpoints

- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `GET /api/me` - Current user profile
- `POST /api/auth/github/login` - OAuth login
- `GET /api/approvals` - List approvals
- `POST /api/approvals/:id/decide` - Approve/reject approval
- `POST /api/pj/execute` - Execute governed action

### Admin Endpoints

- `GET /pj/admin` - Admin panel UI
- `GET /api/admin/stats` - Operational statistics
- `GET /api/admin/audit` - Audit events

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Web Clients   │────│  PuddleJumper    │────│  Connectors     │
│                 │    │  Control Plane   │    │  (GitHub, etc.) │
│ - Admin UI      │    │                  │    │                 │
│ - Landing Page  │    │ - Auth & OAuth   │    │ - Slack         │
│ - API Clients   │    │ - Approval Engine│    │ - Webhooks      │
└─────────────────┘    │ - Audit Logging  │    │ - Custom APIs   │
                       └──────────────────┘    └─────────────────┘
```

## Security

- **Multi-tenant isolation** with workspace-scoped data
- **JWT-based authentication** with configurable issuers
- **Role-based access control** (admin/viewer roles)
- **Audit logging** for all governance decisions
- **CSP headers** and security middleware
- **Rate limiting** and request validation

## Development

### Project Structure

```
├── apps/puddlejumper/     # Main application
│   ├── src/api/          # Express server & routes
│   ├── public/           # Static web assets
│   └── test/             # Application tests
├── packages/core/        # Shared business logic
├── packages/logic-commons/ # Auth & OAuth utilities
└── docs/                 # Documentation
```

### Testing

> **Note**: The repository currently has both `test/` and `tests/` directories. These should be consolidated in a future update for consistency.

```bash
# Run all tests
pnpm run test

# Run specific test suites
pnpm run test:pj        # PuddleJumper tests
pnpm run test:core      # Core package tests

# Type checking
pnpm run typecheck
```

### Building

```bash
# Build all packages
pnpm run build

# Build specific packages
pnpm run build:pj
pnpm run build:core
```

## Roadmap

See [What's Next](./docs/NEXT.md) for the post-V1 roadmap and prioritized next steps.

## Deployment

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions on deploying to Vercel, Fly.io, and other platforms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

See LICENSE file for details.

## Support

- Documentation: [./docs/](./docs/)
- Issues: GitHub Issues
- Security: Use GitHub's private vulnerability reporting or contact security@publiclogic.org