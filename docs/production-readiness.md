# Production Readiness Delta — v2.0.11

This report reflects the actual state of the codebase after the production hardening pass.

---

## What was added

### Infrastructure

| Gate | Added |
|---|---|
| Frontend ESLint | `eslint.config.js` — TypeScript-aware rules, runs on every push/PR |
| Frontend Prettier | `.prettierrc` + `npm run format` |
| Frontend CI | `frontend-ci.yml` — ESLint + typecheck + format + vitest + npm audit + build |
| Backend ruff lint | `pyproject.toml` + `ruff check .` in backend CI |
| Backend coverage | `--cov=app --cov-fail-under=75` in backend CI |
| Gitleaks | Added to `repo-hygiene.yml` |
| Dependabot | `.github/dependabot.yml` — weekly npm + pip + GitHub Actions |
| Bundle size check | `frontend/scripts/check-bundle-size.js` — hard-fails at 5MB |

### Tests added

| Test file | Purpose |
|---|---|
| `frontend/src/api/client.test.ts` | API error handling |
| `frontend/src/api/schemas.test.ts` | Zod schema validation |
| `frontend/src/hooks/ipc-validation.test.ts` | Route sanitization |
| `frontend/src/hooks/useSSE.test.ts` | SSE event names |
| `frontend/src/hooks/appStorage.test.ts` | localStorage key utilities |
| `backend/tests/test_migrations.py` | Checksum drift detection |
| `backend/tests/test_load.py` | 50-concurrent-request health test |
| `backend/tests/test_request_log.py` | X-Request-ID tracing |
| `backend/tests/test_n_plus_one.py` | N+1 query detection (smoke-level) |

### Docs added

`docs/architecture-overview.md`, `docs/engineering-standards.md`, `docs/backend-architecture.md`, `docs/testing-strategy.md`, `docs/migrations.md`, `docs/security-model.md`, `docs/ADR-002-security-model.md`, `docs/observability.md`, `docs/error-taxonomy.md`, `docs/runbook.md`

---

## What is actually broken or unreliable

### 1. Migration drift — only warns, does not fail

`database.py` logs a warning when a previously-applied migration file has been modified, but does not raise an exception or stop startup. This means drift is detectable but not fail-safe.

**Fix needed:** Make drift raise on production builds, or at minimum add a `DOPAFLOW_STRICT_MIGRATION_CHECKS=1` env var that makes it fail.

### 2. Backend tests not validated against current codebase

The new backend tests (`test_migrations.py`, `test_load.py`, `test_n_plus_one.py`, `test_request_log.py`) were written against the current codebase structure but have not been run to confirm they pass. They are structurally sound but unverified.

**Fix needed:** Run `cd backend && pytest tests/ -v --tb=short` to confirm green.

### 3. Frontend unit tests not validated

The 5 Vitest test files were written but not run. They may have import/mock issues.

**Fix needed:** Run `cd frontend && npm run test:unit` to confirm green.

### 4. `test_n_plus_one.py` uses basic SQLite instrumentation

The N+1 tests use a simple `conn.execute` monkey-patch. This is a smoke test, not a reliable N+1 detector — it may not correctly intercept all queries depending on how the app's DB connection is obtained.

**Fix needed:** Replace with `sqlite3.trace()` callback or connection-level instrumentation that actually observes all query calls.

### 5. Migration drift not tested in CI

`test_migrations.py` tests drift detection locally but there is no CI job that runs it automatically against new migration files.

---

## What was not done (intentionally or not yet)

| Item | Status |
|---|---|
| Docker / container deploy path | Not done — explicit non-Docker desktop app stance needed |
| IaC / deploy environment definition | Not done |
| Real telemetry / observability stack | Docs only; no materially wired implementation |
| Real error tracking (Sentry) | Opt-in path documented, not enabled |
| API contract diffing | Not done |
| Accessibility testing | Not done |
| Browser support matrix | Not done |
| SBOM | Not done — intentional for single-user app |
| Rollback strategy | Forward-only, documented as such — acceptable |
| Workspace/monorepo unification | Not done — current structure acceptable |
| Smoke E2E in normal CI | Not done — only on release tags |
| Strict migration drift enforcement | Only warns, not fails |

---

## Scorecard

| Area | Status | Notes |
|---|---|---|
| **Architecture doc** | Solid | |
| **Quality gates** | Solid | Frontend CI + Backend CI on every push/PR |
| **Lint/typecheck/format** | Solid | ESLint + Prettier + Ruff |
| **Testing pyramid** | Weak | 5 frontend test files unverified; backend tests unverified |
| **Coverage reporting** | Weak | Backend 75% threshold set but not confirmed; frontend 15% set but not confirmed |
| **Migration safety** | Partial | Checksum tracking works; drift only warns, does not fail |
| **Auth paths** | Solid | Documented and code-reviewed |
| **IPC security** | Solid | Allowlist-based, tested |
| **CI on push/PR** | Solid | Frontend CI + Backend CI + Repo Hygiene |
| **CI on release tags** | Solid | Full build + E2E + packaging |
| **Dependency hygiene** | Solid | npm audit + pip-audit + Gitleaks + Dependabot |
| **Secret scanning** | Solid | Gitleaks + hygiene patterns |
| **Desktop startup tests** | Solid | `desktop/tests/` |
| **Performance sanity** | Partial | Bundle hard-fail; N+1 tests are smoke-level, not robust |
| **Observability** | Partial | Docs exist; no materially wired implementation |
| **Error taxonomy** | Solid | Documented |
| **Recovery/runbook** | Solid | Documented |
| **Docs accuracy** | Partial | README updated; production-readiness.md now honest |

**Overall: 7.6/10 — real improvement over baseline, but not production-grade. Known reliable: CI enforcement, lint/format, desktop tests. Known weak: migration drift not fail-safe, new backend tests unverified, new frontend tests unverified, observability docs-only, N+1 tests are smoke.**
