.DEFAULT_GOAL := help
SERVICES := auth marketplace community usage
COMPOSE_PROD := docker compose -f docker-compose.prod.yml
SSO_MODES := dev off keycloak
ifneq ($(filter-out $(SSO_MODES),$(sso)),)
$(error sso must be one of: $(SSO_MODES))
endif
# sso=keycloak adds a local Keycloak as the IdP; sso=dev|off sets SSO_MODE; no sso keeps .env (default: dev)
COMPOSE_DEV := $(if $(filter dev off,$(sso)),SSO_MODE=$(sso) )docker compose$(if $(filter keycloak,$(sso)), -f docker-compose.yml -f docker-compose.sso.yml)

help: ## List the available commands
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install backend (uv) and frontend (npm) dependencies
	uv sync --all-packages
	cd frontend && npm ci

dev: ## Run the development stack → http://localhost:8080/AI/ · sign-in: sso=dev (default) | keycloak | off
	$(COMPOSE_DEV) up --build --remove-orphans

down: ## Stop the development stack
	docker compose down --remove-orphans

reset: ## Stop the development stack and delete its data (re-seeds on next start)
	docker compose down -v --remove-orphans

logs: ## Follow the logs of every service
	$(COMPOSE_DEV) logs -f --tail=100

test: ## Backend and frontend tests
	uv run pytest
	cd frontend && npm test

lint: ## Lint and type-check everything
	uv run ruff check libs services
	uv run ruff format --check libs services
	uv run mypy libs/portal-kit/src $(addprefix services/,$(addsuffix /src,$(SERVICES)))
	cd frontend && npm run lint && npm run typecheck

fmt: ## Format the backend code
	uv run ruff check --fix libs services
	uv run ruff format libs services

migration: ## New Alembic revision in the running stack: make migration svc=community m="add reactions"
	docker compose exec $(svc) alembic revision --autogenerate -m "$(m)"

images: ## Build the release images
	$(COMPOSE_PROD) build

prod: ## Run the release images locally (needs JWT_SECRET)
	$(COMPOSE_PROD) up -d --build

.PHONY: help install dev down reset logs test lint fmt migration images prod
