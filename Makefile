.DEFAULT_GOAL := help
COMPOSE := docker compose
PRERELEASE ?= false
SOURCE_COMMIT ?= $(shell git rev-parse --short=7 HEAD 2>/dev/null || printf "unknown")

.PHONY: help install infra dev up launch down stop restart logs status tunnel-check tunnel-up tunnel-down tunnel-restart tunnel-logs tunnel-status build migrate seed seed-10k test test-10k e2e check publish-wiki release shell db-shell clean destroy

help: ## List all commands
	@awk 'BEGIN {FS = ":.*## "; printf "Atlore commands:\n\n"} /^[a-zA-Z0-9_-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Install npm dependencies
	npm install

infra: ## Start PostgreSQL, Redis, and MinIO for local development
	$(COMPOSE) up -d postgres redis minio minio-init

dev: infra migrate ## Start the local Vite development server
	npm run dev

up: ## Build and start the complete production stack
	SOURCE_COMMIT=$(SOURCE_COMMIT) $(COMPOSE) up -d --build

launch: up ## Alias for up

down: ## Stop and remove containers while preserving data
	$(COMPOSE) down

stop: ## Stop containers without removing them
	$(COMPOSE) stop

restart: ## Restart the complete stack
	$(COMPOSE) restart

logs: ## Follow application logs
	$(COMPOSE) logs -f --tail=150 app

status: ## Show container status and health checks
	$(COMPOSE) ps

tunnel-check: ## Validate the Cloudflare Tunnel configuration
	./scripts/check-cloudflare-tunnel.sh

tunnel-up: tunnel-check ## Start the production stack with Cloudflare Tunnel
	SOURCE_COMMIT=$(SOURCE_COMMIT) $(COMPOSE) --profile tunnel up -d --build

tunnel-down: ## Stop only the public Cloudflare Tunnel
	$(COMPOSE) --profile tunnel stop cloudflared

tunnel-restart: tunnel-check ## Recreate only the Cloudflare Tunnel
	$(COMPOSE) --profile tunnel up -d --force-recreate cloudflared

tunnel-logs: ## Follow Cloudflare Tunnel logs
	$(COMPOSE) --profile tunnel logs -f --tail=150 cloudflared

tunnel-status: ## Show Atlore and Cloudflare Tunnel status
	$(COMPOSE) --profile tunnel ps app cloudflared

build: ## Create a production build
	npm run build

migrate: ## Run database migrations
	npm run db:migrate

seed: ## Populate the database with the Atlore demo world
	npm run db:seed

seed-10k: ## Create a repeatable 10k-node world for LOAD_TEST_EMAIL
	npm run db:seed:10k

test: ## Run unit and integration tests
	npm run test

test-10k: ## Test the 10k-node campaign in a real Chromium browser
	npm run test:load

e2e: ## Run Playwright end-to-end tests
	npm run test:e2e

check: ## Run type checking, linting, and tests
	npm run check && npm run lint && npm run test

publish-wiki: ## Publish docs/wiki to the GitHub Wiki
	./scripts/publish-wiki.sh

release: ## Start the manual release workflow after explicit approval
	@test -n "$(VERSION)" || (echo "Usage: make release VERSION=1.1.0 [PRERELEASE=true]" >&2; exit 1)
	@printf "Start GitHub Release v$(VERSION) from main? [y/N] "; read answer; \
		case "$$answer" in y|Y) ;; *) echo "Release cancelled."; exit 1 ;; esac; \
		gh workflow run release.yml --ref main --field version="$(VERSION)" --field prerelease="$(PRERELEASE)"

shell: ## Open a shell in the application container
	$(COMPOSE) exec app sh

db-shell: ## Open psql in PostgreSQL
	$(COMPOSE) exec postgres psql -U atlore -d atlore

clean: ## Remove generated local build files only
	npm exec rimraf -- build .svelte-kit coverage playwright-report test-results

destroy: ## Remove containers and volumes after confirmation
	@read -p "Permanently remove all Atlore data? [y/N] " answer; [ "$$answer" = "y" ]
	$(COMPOSE) down -v --remove-orphans
