.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help install infra dev up launch down stop restart logs status tunnel-check tunnel-up tunnel-down tunnel-restart tunnel-logs tunnel-status build migrate seed seed-10k test test-10k e2e check publish-wiki shell db-shell clean destroy

help: ## Toon alle commando's
	@awk 'BEGIN {FS = ":.*## "; printf "Atlore commando’s:\n\n"} /^[a-zA-Z_-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Installeer npm-afhankelijkheden
	npm install

infra: ## Start alleen Postgres, Redis en MinIO voor lokale ontwikkeling
	$(COMPOSE) up -d postgres redis minio minio-init

dev: infra migrate ## Start de lokale Vite-ontwikkelserver
	npm run dev

up: ## Bouw en start de volledige productiestack
	$(COMPOSE) up -d --build

launch: up ## Alias voor up

down: ## Zet alle containers uit (data blijft staan)
	$(COMPOSE) down

stop: ## Stop containers zonder ze te verwijderen
	$(COMPOSE) stop

restart: ## Herstart de volledige stack
	$(COMPOSE) restart

logs: ## Volg de app-logs
	$(COMPOSE) logs -f --tail=150 app

status: ## Toon containerstatus en healthchecks
	$(COMPOSE) ps

tunnel-check: ## Controleer de Cloudflare Tunnel-configuratie
	./scripts/check-cloudflare-tunnel.sh

tunnel-up: tunnel-check ## Start de productiestack met Cloudflare Tunnel
	$(COMPOSE) --profile tunnel up -d --build

tunnel-down: ## Stop alleen de publieke Cloudflare Tunnel
	$(COMPOSE) --profile tunnel stop cloudflared

tunnel-restart: tunnel-check ## Herstart alleen de Cloudflare Tunnel
	$(COMPOSE) --profile tunnel up -d --force-recreate cloudflared

tunnel-logs: ## Volg de Cloudflare Tunnel-logs
	$(COMPOSE) --profile tunnel logs -f --tail=150 cloudflared

tunnel-status: ## Toon de status van Atlore en Cloudflare Tunnel
	$(COMPOSE) --profile tunnel ps app cloudflared

build: ## Maak een productiebuild
	npm run build

migrate: ## Voer database-migraties uit
	npm run db:migrate

seed: ## Vul de database met de Atlore-demowereld
	npm run db:seed

seed-10k: ## Maak een herhaalbare 10k-node loadtest voor LOAD_TEST_EMAIL
	npm run db:seed:10k

test: ## Draai unit- en integratietests
	npm run test

test-10k: ## Test de 10k-node campagne in een echte Chromium-browser
	npm run test:load

e2e: ## Draai Playwright end-to-endtests
	npm run test:e2e

check: ## Typecheck, lint en tests
	npm run check && npm run lint && npm run test

publish-wiki: ## Publiceer docs/wiki naar de GitHub Wiki
	./scripts/publish-wiki.sh

shell: ## Open een shell in de appcontainer
	$(COMPOSE) exec app sh

db-shell: ## Open psql in Postgres
	$(COMPOSE) exec postgres psql -U atlore -d atlore

clean: ## Verwijder alleen gegenereerde lokale buildbestanden
	npm exec rimraf -- build .svelte-kit coverage playwright-report test-results

destroy: ## Verwijder containers én volumes na bevestiging
	@read -p "Alle Atlore-data definitief verwijderen? [y/N] " answer; [ "$$answer" = "y" ]
	$(COMPOSE) down -v --remove-orphans
