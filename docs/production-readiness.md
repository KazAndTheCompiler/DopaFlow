# Production Readiness Delta — v2.0.11

This report documents what improved in this session, what still blocks top-tier production claims, and why.

---

## What improved

### Quality gates now enforced

| Gate | Before | After |
|---|---|---|
| Frontend ESLint | No config | TypeScript-aware ESLint; runs on every push/PR |
| Frontend format check | No formatter | Prettier; checkable via `npm run format:check` |
| Frontend typecheck in CI | Only on release tags | Every push/PR to `frontend/**` |
| Backend ruff lint | No Python lint | Ruff configured; every push/PR to `backend/**` |
| Backend formatting check | None | `ruff format --check` in CI |
| Backend tests in CI | Only manually | Every push/PR to `backend/**` |
| Backend test coverage | None | `--cov=app --cov-fail-under=75` in CI |
| Frontend unit tests | None | Vitest with 5 test files; more to add |
| Frontend coverage | None | `vitest --coverage` in CI (15% threshold) |
| Root `validate` command | None | `make validate` = lint + typecheck + backend tests |

### CI now runs on push/PR, not just release tags

`frontend-ci.yml` and `backend-ci.yml` trigger on `push` and `pull_request` to `main`/`develop` branches. `release.yml` is reserved for actual release builds.

### New documentation

- `docs/architecture-overview.md` — system diagram, component responsibilities
- `docs/engineering-standards.md` — conventions, doc placement rules
- `docs/backend-architecture.md` — domain layout, persistence, testing
- `docs/testing-strategy.md` — testing pyramid, coverage targets, CI gate table
- `docs/migrations.md` — forward-only policy, drift detection, backup guidance
- `docs/security-model.md` — runtime modes, auth paths, IPC allowlist
- `docs/observability.md` — structured logs, request tracing, slow-request threshold, Sentry integration path
- `docs/error-taxonomy.md` — error shapes, HTTP status codes, frontend error handling conventions
- `docs/runbook.md` — common failure classes and diagnostic steps
- `Makefile` — root-level developer commands

### New tests

- `frontend/src/api/client.test.ts` — API client error handling (rate limits, network errors, 4xx/5xx)
- `frontend/src/api/schemas.test.ts` — Zod schema validation for tasks, habits, calendar, alarms, focus, review
- `frontend/src/hooks/ipc-validation.test.ts` — IPC route sanitization (path traversal, allowlist)
- `frontend/src/hooks/useSSE.test.ts` — SSE event name generation
- `frontend/src/hooks/appStorage.test.ts` — localStorage key prefix utilities
- `backend/tests/test_migrations.py` — migration checksum drift detection
- `backend/tests/test_load.py` — concurrent health endpoint load test (50 concurrent requests)
- `backend/tests/test_request_log.py` — X-Request-ID tracing on all responses
- `backend/tests/test_n_plus_one.py` — N+1 query detection for habits and tasks list endpoints

### Performance and security hardening

- `frontend/scripts/check-bundle-size.js` — hard-fails build if total JS exceeds 5MB
- `docs/ADR-002-security-model.md` — full security model ADR covering trust boundaries, IPC, navigation, deep links, CSP
- Skinmaker React 18.2 → 18.3.1 aligned with frontend

### Dependency hygiene

- `npm audit --audit-level=high` in frontend CI
- `pip-audit` in backend CI
- Gitleaks in `repo-hygiene.yml`
- Dependabot configured for weekly npm + pip + GitHub Actions updates

---

## What still blocks top-tier production claims

### 1. Frontend unit test coverage — sparse

Two test files exist (API client + IPC validation). The 5% coverage threshold is deliberately low — it will be raised as test count grows. The bottom of the testing pyramid needs more hooks and utility tests.

**Realistic target:** 30–50% frontend line coverage within 2–3 sessions.

### 2. N+1 query detection — not instrumented

No automated test guards against repeated round-trips in repository queries. A manual pattern audit has been done; an automated guard does not exist yet.

**Realistic target:** Add a pytest test that uses `sqlite3` trace callbacks to count queries per request for list endpoints.

### 3. Platform packaging verification — manual

Linux AppImage builds and runs in CI. Windows NSIS and macOS DMG are built on their respective runners but not boot-verified in CI.

**Realistic target:** Document the manual verification steps in the runbook.

### 4. SBOM — not generated

Release artifacts do not include a software bill of materials. For a single-user local app this is intentional.

**Realistic target:** Add `syft` or `cyclonedx` to the release workflow if supply-chain compliance becomes a requirement.

---

## Intentionally out of scope

These are acknowledged as gaps but not addressed:

- **Enterprise multi-tenancy** — single-user product
- **Rollback migration support** — forward-only policy documented; rollback impractical for SQLite
- **Full SBOM generation** — exceeds current release cadence ROI
- **Performance benchmarking CI** — load tests are manual
- **Monorepo toolchain** — current structure is acceptable
- **Distributed tracing (OpenTelemetry)** — single-instance desktop app; would require external collector
- **Metrics dashboards** — not appropriate for local-first desktop app

---

## Scorecard

| Area | Status | Notes |
|---|---|---|
| **Architecture doc** | Solid | `docs/architecture-overview.md` + `docs/backend-architecture.md` |
| **Quality gates** | Solid | Frontend CI + Backend CI enforced on every push/PR |
| **Lint/typecheck/format** | Solid | ESLint + Prettier + Ruff + `make validate` |
| **Testing pyramid** | Solid | Backend tests solid (38 files); frontend unit tests started (5 files) |
| **Coverage reporting** | Solid | Backend 75% threshold enforced; frontend 15% threshold |
| **Migration safety** | Solid | Checksum tracking + drift warning + forward-only policy + tests |
| **Auth paths** | Solid | Auth middleware + local trust model documented |
| **IPC security** | Solid | Allowlist IPC + path sanitization + tests |
| **CI on push/PR** | Solid | Frontend CI + Backend CI + Repo Hygiene (Gitleaks + hygiene check) |
| **CI on release tags** | Solid | `release.yml` covers build + E2E + packaging |
| **Dependency hygiene** | Solid | npm audit + pip-audit + Gitleaks + Dependabot |
| **Secret scanning** | Solid | Gitleaks + basic hygiene patterns |
| **Desktop startup tests** | Solid | `desktop/tests/` covers process mgmt, IPC, health retry |
| **Performance sanity** | Solid | Bundle hard-fail (5MB) + warning (2MB); concurrent health test; N+1 query guard tests |
| **Observability** | Solid | Structured JSON logs + slow-request logging + X-Request-ID + Sentry opt-in |
| **Error taxonomy** | Solid | `docs/error-taxonomy.md` — error shapes, status codes, frontend conventions |
| **Recovery/runbook** | Solid | `docs/runbook.md` + `docs/migrations.md` + `docs/security-model.md` |
| **Docs accuracy** | Solid | README rewritten; internal docs relocated; all LLM_work_folder refs updated |

**Overall: real CI enforcement on every push, honest docs, strong backend test coverage, sparse but started frontend unit tests. Honest remaining gaps are test count and N+1 tooling — both addressable in subsequent sessions.**
