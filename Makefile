# PuddleJumper Monorepo — Makefile
# Run `make help` to see all available commands.

.DEFAULT_GOAL := help

# ─── Setup ────────────────────────────────────────────────────────────
.PHONY: setup
setup: ## First-time setup (install deps, build, run tests)
	bash scripts/bootstrap.sh

.PHONY: install
install: ## Install dependencies (pnpm)
	cd n8drive && pnpm install

# ─── Development ──────────────────────────────────────────────────────
.PHONY: dev
dev: ## Start PuddleJumper backend (port 3002)
	cd n8drive && pnpm run dev

.PHONY: dev-web
dev-web: ## Start Next.js frontend dev server
	cd n8drive/web && npm run dev

# ─── Build ────────────────────────────────────────────────────────────
.PHONY: build
build: ## Build all packages
	cd n8drive && pnpm run build

.PHONY: build-pj
build-pj: ## Build PuddleJumper backend only
	cd n8drive && pnpm run build:pj

.PHONY: build-web
build-web: ## Build Next.js frontend only
	cd n8drive && pnpm run build:web

# ─── Test ─────────────────────────────────────────────────────────────
.PHONY: test
test: ## Run all tests
	cd n8drive && pnpm run test

.PHONY: test-pj
test-pj: ## Run PuddleJumper tests only
	cd n8drive && pnpm run test:pj

.PHONY: test-core
test-core: ## Run core package tests only
	cd n8drive && pnpm run test:core

.PHONY: typecheck
typecheck: ## TypeScript type-check across all packages
	cd n8drive && pnpm run typecheck

.PHONY: ci
ci: ## Full CI pipeline (typecheck + contract check + tests)
	cd n8drive && pnpm run ci

# ─── Quality ──────────────────────────────────────────────────────────
.PHONY: lint
lint: ## Lint the Next.js frontend
	cd n8drive/web && npm run lint

.PHONY: sync-check
sync-check: ## Check playbook sync drift (CI-friendly)
	./scripts/sync-playbooks.sh --check

.PHONY: sync
sync: ## Sync playbooks from canonical source
	./scripts/sync-playbooks.sh

# ─── Deploy ───────────────────────────────────────────────────────────
.PHONY: deploy-fly
deploy-fly: ## Deploy to Fly.io
	cd n8drive && pnpm run deploy:fly

.PHONY: deploy-vercel
deploy-vercel: ## Deploy to Vercel
	cd n8drive && pnpm run deploy:vercel

# ─── Docker ───────────────────────────────────────────────────────────
.PHONY: docker-build
docker-build: ## Build Docker image
	cd n8drive && docker build -t puddlejumper .

.PHONY: docker-up
docker-up: ## Start services with docker-compose
	cd n8drive && docker compose up -d

.PHONY: docker-down
docker-down: ## Stop docker-compose services
	cd n8drive && docker compose down

# ─── Maintenance ──────────────────────────────────────────────────────
.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf n8drive/node_modules
	rm -rf n8drive/apps/*/node_modules
	rm -rf n8drive/packages/*/node_modules
	rm -rf n8drive/web/node_modules
	find n8drive -name 'dist' -type d -exec rm -rf {} + 2>/dev/null || true
	find n8drive -name '*.tsbuildinfo' -delete 2>/dev/null || true

.PHONY: smoke
smoke: ## Run local smoke test
	bash smoke-test.sh

# ─── Help ─────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show this help message
	@echo ""
	@echo "  PuddleJumper — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  Quick start:  make setup   →  make dev"
	@echo ""
