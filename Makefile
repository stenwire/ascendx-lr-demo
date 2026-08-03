SHELL := /bin/sh
POSTGRES_CONTAINER := app-postgres-1
.DEFAULT_GOAL := help

.PHONY: help \
        up down restart logs logs-server logs-client logs-postgres ps up-db \
        db-shell db-reset docker-seed \
        install install-server install-client \
        dev-server dev-client \
        migrate generate seed \
        test test-server test-client build clean

# Help text avoids ( ) & < > | ^ so the same recipe runs under both /bin/sh and
# cmd.exe -- make picks whichever shell the machine has, and each treats a
# different set of characters as syntax.
help: ## Show this help
	@echo Available targets:
	@echo   Docker - whole stack
	@echo   up - Build and start postgres, server on 4000, client on 5173. Add LOGS=1 to follow logs.
	@echo   down - Stop and remove all containers. Keeps the data volume.
	@echo   restart - Rebuild and restart the whole stack.
	@echo   ps - Show status of docker compose services.
	@echo   docker-seed - Seed the dockerized database. Run once.
	@echo   Logs
	@echo   logs - Tail logs for all services, interleaved.
	@echo   logs-server - Tail logs for the server container only.
	@echo   logs-client - Tail logs for the client container only.
	@echo   logs-postgres - Tail logs for the postgres container only.
	@echo   Database
	@echo   up-db - Start only Postgres, for running server and client on the host.
	@echo   db-shell - Open a psql shell inside the running Postgres container.
	@echo   db-reset - Drop and recreate the dev database - DATA LOSS - then migrate.
	@echo   migrate - Run Prisma migrations against the dev database.
	@echo   generate - Regenerate the Prisma client.
	@echo   seed - Seed the dev database from the host.
	@echo   Host dev
	@echo   install - Install dependencies for both server and client.
	@echo   dev-server - Run the backend on the host at http://localhost:4000
	@echo   dev-client - Run the frontend on the host at http://localhost:5173
	@echo   Test and build
	@echo   test - Run both test suites.
	@echo   test-server - Create the test database if needed, then run server tests.
	@echo   test-client - Run the frontend test suite. No database needed.
	@echo   build - Build server and client for production.
	@echo   clean - Remove node_modules and build output.

## --- Docker: full stack (postgres + server + client) -----------------------

up: ## Build and start the whole app in Docker (postgres, server :4000, client :5173). Add LOGS=1 to follow logs after starting.
	docker compose up -d --build
ifeq ($(LOGS),1)
	docker compose logs -f
endif

down: ## Stop and remove all containers (keeps the data volume)
	docker compose down

restart: down up ## Rebuild and restart the whole stack

logs: ## Tail logs for all services (interleaved)
	docker compose logs -f

logs-server: ## Tail logs for the server container only
	docker compose logs -f server

logs-client: ## Tail logs for the client container only
	docker compose logs -f client

logs-postgres: ## Tail logs for the postgres container only
	docker compose logs -f postgres

ps: ## Show status of docker compose services
	docker compose ps

docker-seed: ## Seed the database (run once, against the dockerized stack)
	docker compose exec server npm run seed

## --- Docker: Postgres only (for running server/client on the host instead) --

up-db: ## Start only Postgres, for a hybrid workflow (host npm + dockerized db)
	docker compose up -d postgres

db-shell: ## Open a psql shell inside the running Postgres container
	docker exec -it $(POSTGRES_CONTAINER) psql -U leave_app -d leave_app

db-reset: ## Drop and recreate the dev database (data loss!) and re-run migrations
	docker exec $(POSTGRES_CONTAINER) dropdb -U leave_app --if-exists leave_app
	docker exec $(POSTGRES_CONTAINER) createdb -U leave_app leave_app
	$(MAKE) migrate

## --- Host-based dev (no server/client containers) ---------------------------

install: install-server install-client ## Install dependencies for both server and client

install-server: ## Install server dependencies
	cd server && npm install

install-client: ## Install client dependencies
	cd client && npm install

dev-server: ## Run the backend on the host in watch mode (http://localhost:4000)
	cd server && npm run dev

dev-client: ## Run the frontend dev server on the host (http://localhost:5173)
	cd client && npm run dev

migrate: ## Run Prisma migrations against the dev database
	cd server && npm run prisma:migrate

generate: ## Regenerate the Prisma client
	cd server && npm run prisma:generate

seed: ## Seed the dev database from the host (server deps must be installed)
	cd server && npm run seed

## --- Test / Build -------------------------------------------------------------

test: test-server test-client ## Run both test suites

test-server: ## Create the test database (if needed) and run the server test suite
	-docker exec $(POSTGRES_CONTAINER) createdb -U leave_app leave_app_test
	cd server && npm test

test-client: ## Run the frontend test suite (no database needed)
	cd client && npm test

build: ## Build server and client for production
	cd server && npm run build
	cd client && npm run build

## --- Cleanup -------------------------------------------------------------------

clean: ## Remove node_modules and build output from server and client
	node -e "for (const p of ['server/node_modules','server/dist','client/node_modules','client/dist']) require('fs').rmSync(p, { recursive: true, force: true })"
