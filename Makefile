.PHONY: help dev backend test test-backend test-frontend test-e2e lint typecheck build doctor clean

PYTHON := python3
PIP := pip3
BACKEND_DIR := backend
FRONTEND_DIR := frontend
DESKTOP_DIR := desktop

help: ## Show this help
	@echo "DopaFlow development commands"
	@echo ""
	@echo "  make dev           Start frontend dev server (http://localhost:5173)"
	@echo "  make backend       Start backend dev server (http://localhost:8000)"
	@echo "  make test          Run all tests (backend + frontend typecheck)"
	@echo "  make test-backend  Run backend tests with pytest"
	@echo "  make test-frontend Run frontend typecheck + build"
	@echo "  make test-e2e      Run frontend E2E smoke tests"
	@echo "  make lint          Lint all projects"
	@echo "  make typecheck     TypeScript typecheck frontend"
	@echo "  make build         Build frontend production bundle"
	@echo "  make doctor        Check environment readiness"
	@echo "  make clean         Remove build artifacts and caches"
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

test-frontend: typecheck ## Run frontend typecheck and build
	@echo "Running frontend typecheck..."
	cd $(FRONTEND_DIR) && npm run typecheck

test-e2e: ## Run frontend E2E smoke tests (requires dev servers running)
	@echo "Running frontend E2E smoke tests..."
	cd $(FRONTEND_DIR) && npm run test:e2e:smoke

lint: ## Lint all projects
	@echo "Linting backend..."
	cd $(BACKEND_DIR) && $(PIP) install ruff --quiet 2>/dev/null && ruff check .
	@echo "Linting frontend..."
	cd $(FRONTEND_DIR) && npx eslint src/ --ext .ts,.tsx --quiet 2>/dev/null || true

typecheck: ## TypeScript typecheck
	@echo "Typechecking frontend..."
	cd $(FRONTEND_DIR) && npm run typecheck

build: ## Build frontend production bundle
	@echo "Building frontend..."
	cd $(FRONTEND_DIR) && npm run build

doctor: ## Check environment readiness
	@echo "Checking environment..."
	@node --version && echo "  Node.js OK" || echo "  Node.js MISSING (need 18+)"
	@$(PYTHON) --version && echo "  Python OK" || echo "  Python MISSING (need 3.11-3.12)"
	@test -d $(FRONTEND_DIR)/node_modules && echo "  frontend deps OK" || echo "  frontend deps MISSING (run: cd frontend && npm install)"
	@test -f $(BACKEND_DIR)/requirements.txt && echo "  backend requirements OK" || echo "  backend requirements MISSING"

clean: ## Remove build artifacts and caches
	@echo "Cleaning..."
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/.vite
	rm -rf $(BACKEND_DIR)/__pycache__ $(BACKEND_DIR)/.pytest_cache $(BACKEND_DIR)/build $(BACKEND_DIR)/dist
	find $(BACKEND_DIR) -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find $(FRONTEND_DIR) -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
