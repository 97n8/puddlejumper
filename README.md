# PuddleJumper

A distributed governance and case management system for municipalities, built by PublicLogic.

## Overview

PuddleJumper is an API-first platform designed to handle public records requests, case management, and governance workflows for municipal organizations. It provides secure, auditable, and compliant solutions for government operations.

## Repository Structure

This repository is organized as a monorepo containing multiple related projects:

### Core Platform

- **[n8drive/](n8drive/)** - Main monorepo containing:
  - `apps/puddlejumper` - Core Express API server (TypeScript)
  - `packages/core` - Shared utilities and authentication
  - `apps/logic-commons` - Shared Express middleware
  - `apps/website` - Logic Commons website

### Supporting Components

- **[chamber-connect/](chamber-connect/)** - Case management prototype for North Central Chamber of Commerce
  - Intake and routing system
  - SLA tracking
  - Audit logging

- **[live-edit-deploy-console/](live-edit-deploy-console/)** - Tenebrux Veritas
  - Internal deployment UI for municipal M365 VAULT governance
  - React + Vite frontend with Node.js backend

- **[publiclogic-operating-system/](publiclogic-operating-system/)** - Documentation
  - Mission statements
  - Delivery playbooks
  - Operational metrics

- **[publiclogic-os-ui/](publiclogic-os-ui/)** - Operating System UI components

- **[publiclogic-site/](publiclogic-site/)** - Marketing and documentation website

### Other Components

- **[AGNOSTIC/](AGNOSTIC/)** - Platform-agnostic utilities
- **[Public_Logic/](Public_Logic/)** - Public logic components
- **[pl-poli-case-workspace/](pl-poli-case-workspace/)** - Policy case workspace

## Technology Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: SQLite3 (PRR, connectors, idempotency, rate-limiting)
- **Authentication**: JWT (RS256/HS256 support via jose)
- **Frontend**: React, Vite
- **Testing**: Vitest, Playwright, Supertest
- **Deployment**: Render.com (production), Vercel compatible
- **Package Management**: pnpm workspaces with npm fallback

## Key Features

- 🔐 **Security-First**: CSRF protection, HttpOnly cookies, JWT validation, role-based authorization
- 📋 **Case Management**: Public Records Request (PRR) intake and routing with SLA tracking
- 🔌 **Connector Integrations**: SharePoint, GitHub, and other external systems
- 📝 **Audit Logging**: Comprehensive audit trails for compliance
- ⚡ **Idempotency**: Built-in request idempotency for reliability
- 🎯 **Governance Engine**: Decision workflows and approval processes

## Getting Started

### Prerequisites

- Node.js 18+ or 20+
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/97n8/puddlejumper.git
   cd puddlejumper
   ```

2. Install dependencies for the main platform:
   ```bash
   cd n8drive
   npm install
   # or
   pnpm install
   ```

3. Set up environment variables (see individual component READMEs for details)

4. Build the project:
   ```bash
   npm run build
   ```

5. Run tests:
   ```bash
   npm test
   ```

### Quick Start - PuddleJumper API

```bash
cd n8drive/apps/puddlejumper
npm install
npm run dev
```

The API will be available at `http://localhost:3000` (or the configured PORT).

## Documentation

- [n8drive Documentation](n8drive/README.md) - Main platform documentation
- [Chamber Connect](chamber-connect/README.md) - Case management system
- [Live Edit Deploy Console](live-edit-deploy-console/README.md) - Deployment UI
- [PublicLogic Operating System](publiclogic-operating-system/README.md) - Operational documentation

## Deployment

The project includes configuration for deployment on Render.com:

```bash
# See render.yaml for deployment configuration
# Deploys the puddlejumper API from n8drive/apps/puddlejumper
```

## Testing

Run the smoke test:
```bash
./smoke-test.sh
```

## Contributing

This is a PublicLogic project. Please follow the coding standards and security practices outlined in the component documentation.

## Security

Security is a top priority. The platform includes:
- JWT-based authentication
- CSRF protection
- Rate limiting
- Input validation
- Audit logging

For security concerns, please review the security documentation in individual components.

## License

See individual component directories for licensing information.

## Support

For support and questions, please refer to the individual component READMEs or contact PublicLogic.
