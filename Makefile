.PHONY: help dev backend test test-backend test-frontend test-unit test-e2e lint lint-backend lint-frontend format format-check typecheck build doctor clean validate

PYTHON := python3
PIP := pip3
BACKEND_DIR := backend
FRONTEND_DIR := frontend
DESKTOP_DIR := desktop

help: ## Show this help
	@echo "DopaFlow development commands"
	@echo ""
	@echo "  make dev              Start frontend dev server (http://localhost:5173)"
	@echo "  make backend          Start backend dev server (http://localhost:8000)"
	@echo "  make test             Run all tests (backend + frontend typecheck)"
	@echo "  make test-backend     Run backend tests with pytest"
	@echo "  make test-frontend    Run frontend typecheck"
	@echo "  make test-unit        Run frontend unit tests (Vitest)"
	@echo "  make test-e2e         Run frontend E2E smoke tests"
	@echo "  make lint             Lint all projects (backend + frontend)"
	@echo "  make lint-backend     Lint backend with ruff"
	@echo "  make lint-frontend    Lint frontend with ESLint"
	@echo "  make format           Format all code (prettier + ruff)"
	@echo "  make format-check     Check formatting without modifying files"
	@echo "  make typecheck        TypeScript typecheck frontend"
	@echo "  make build            Build frontend production bundle"
	@echo "  make doctor           Check environment readiness"
	@echo "  make validate         Run all quality checks (lint + typecheck + backend tests)"
	@echo "  make clean            Remove build artifacts and caches"
	@echo ""
	@echo "  Prerequisites: Node 18+, Python 3.11-3.12"

dev: ## Start frontend dev server
	@echo "Starting frontend dev server..."
	cd $(FRONTEND_DIR) && npm run dev

backend: ## Start backend dev server
	@echo "Starting backend dev server..."
	cd $(BACKEND_DIR) && $(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test: test-backend typecheck ## Run backend tests and frontend typecheck

test-backend: ## Run backend pytest suite
	@echo "Running backend tests..."
	cd $(BACKEND_DIR) && $(PYTHON) -m pytest tests/ -v --tb=short

test-frontend: typecheck ## Run frontend typecheck
	@echo "Running frontend typecheck..."
	cd $(FRONTEND_DIR) && npm run typecheck

test-unit: ## Run frontend unit tests with Vitest
	@echo "Running frontend unit tests..."
	cd $(FRONTEND_DIR) && npm run test:unit

test-e2e: ## Run frontend E2E smoke tests (requires dev servers running)
	@echo "Running frontend E2E smoke tests..."
	cd $(FRONTEND_DIR) && npm run test:e2e:smoke

lint: lint-backend lint-frontend ## Lint all projects

lint-backend: ## Lint backend with ruff
	@echo "Linting backend with ruff..."
	cd $(BACKEND_DIR) && ruff check .

lint-frontend: ## Lint frontend with ESLint
	@echo "Linting frontend with ESLint..."
	cd $(FRONTEND_DIR) && npm run lint

format: ## Format all code (prettier + ruff)
	@echo "Formatting frontend with prettier..."
	cd $(FRONTEND_DIR) && npm run format
	@echo "Formatting backend with ruff..."
	cd $(BACKEND_DIR) && ruff format .

format-check: ## Check formatting without modifying files
	@echo "Checking frontend formatting..."
	cd $(FRONTEND_DIR) && npm run format:check
	@echo "Checking backend formatting..."
	cd $(BACKEND_DIR) && ruff format --check .

typecheck: ## TypeScript typecheck
	@echo "Typechecking frontend..."
	cd $(FRONTEND_DIR) && npm run typecheck

build: ## Build frontend production bundle
	@echo "Building frontend..."
	cd $(FRONTEND_DIR) && npm run build

validate: lint-backend lint-frontend typecheck test-backend ## Run all quality checks

doctor: ## Check environment readiness
	@echo "Checking environment..."
	@node --version && echo "  Node.js OK" || echo "  Node.js MISSING (need 18+)"
	@PYTHON_VERSION=$$($(PYTHON) -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")') && \
	  if [ "$$PYTHON_VERSION" = "3.11" ] || [ "$$PYTHON_VERSION" = "3.12" ]; then \
	    echo "  Python $$PYTHON_VERSION OK"; \
	  else \
	    echo "  Python $$PYTHON_VERSION — supported: 3.11 or 3.12 only"; \
	  fi
	@test -d $(FRONTEND_DIR)/node_modules && echo "  frontend deps OK" || echo "  frontend deps MISSING (run: cd frontend && npm install)"
	@test -f $(BACKEND_DIR)/requirements.txt && echo "  backend requirements OK" || echo "  backend requirements MISSING"

clean: ## Remove build artifacts and caches
	@echo "Cleaning..."
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite
	rm -rf $(BACKEND_DIR)/__pycache__ $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/build $(BACKEND_DIR)/dist
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find $(FRONTEND_DIR) -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
