# Testing Strategy

## Testing pyramid

```
        ┌─────────────────┐
        │   E2E / Playwright   │  ← Cross-surface flows only
        │   (frontend/tests/)  │
        └────────┬────────────┘
                 │  (~10 specs)
        ┌────────▼────────────┐
        │   Backend Tests      │  ← Domain logic, API contracts
        │   (backend/tests/)   │    Integration, security, migrations
        └────────┬────────────┘
                 │  (~35 test files)
        ┌────────▼────────────┐
        │   Component / Hook  │  ← Planned: Vitest unit tests for
        │   (frontend/src/)   │    hooks, utilities, UI state
        └─────────────────────┘
```

## Backend tests (`backend/tests/`)

pytest, async-aware via `pytest-asyncio`.

**What they cover:**
- API endpoint contracts (request/response shapes)
- Auth paths (local trust, API-key enforcement)
- Domain logic (service-layer business rules)
- Migration safety (checksum drift detection)
- Rate limiting
- Security (scope enforcement, upload validation)
- Cross-domain integration (journal+habits, calendar+sharing)

**Run:**
```bash
cd backend && pytest tests/ -v --cov=app --cov-report=term-missing
```

**Minimum coverage threshold:** 75% line coverage for `app/` modules (backend), 15% for frontend source. Non-covered lines should be documented as intentionally untested (e.g., platform-specific branches, unlikely error paths).

## Frontend E2E (`frontend/tests/e2e/`)

Playwright, mocked (no live backend required for smoke/core).

**What they cover:**
- Route startup and navigation safety
- Task CRUD flow
- Daily loop (habits + focus + digest)
- Calendar maturity
- Shell breakpoints
- Goals flow

**Run:**
```bash
cd frontend
npm run test:e2e:smoke    # startup + navigation (fast, no backend)
npm run test:e2e:core     # broader mocked coverage
npm run test:e2e:release  # full release slice (requires packaged backend)
```

**Note:** E2E tests are for cross-surface flows. Do not test every component state here — unit/component tests cover that.

## Frontend unit tests (`frontend/src/**/*.test.ts`)

Vitest with jsdom environment.

**What they cover:**
- API client error handling (network errors, rate limits, 4xx/5xx responses)
- IPC route sanitization (path traversal, allowlist enforcement)
- Zod schema validation (tasks, habits, calendar, alarms, focus, review)
- SSE event name generation
- localStorage key prefix utilities

**Run:**
```bash
cd frontend && npm run test:unit           # run once
cd frontend && npm run test:unit:watch    # watch mode
cd frontend && npm run test:unit:coverage # with coverage report
```

**Planned coverage targets:**
- Hooks: `useTasks`, `useHabits`, `useFocus`, `useCalendar`
- Utility functions: date helpers, string formatters
- UI state machines: modal open/close, task row selection
- API client adapters: response parsing, error handling

## CI gates

| Check | Trigger | Fails build? |
|---|---|---|
| `repo-hygiene.yml` | Every push/PR | Yes |
| `frontend-ci.yml` | Push/PR to `frontend/**` | Yes |
| `backend-tests.yml` (quality) | Push/PR to `backend/**` | Yes |
| `backend-tests.yml` (tests) | Push/PR to `backend/**` | Yes |
| `release.yml` | On `v*` tag | Yes |

## What is intentionally not tested

- Trivial getter/setter functions with no logic
- Presentational-only components (snapshot tests not warranted)
- Platform-specific edge cases (Windows/macOS behavior documented, not automated)
- Third-party external services (Google Calendar, YouTube) — integration tests mock responses
