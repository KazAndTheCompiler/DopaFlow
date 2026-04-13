# Engineering Standards

## Folder conventions

```
frontend/src/
├── surfaces/     Route-level page components (Today, Tasks, Calendar…)
├── components/   Shared UI components
├── hooks/        Shared React hooks
├── api/          API client functions
├── design-system/  Tokens, primitives, themed components
└── main.tsx      Entry point

backend/app/
├── domains/      Feature domains (tasks, habits, focus…)
│   └── domain/
│       ├── router.py       FastAPI router
│       ├── service.py      Business logic
│       ├── repository.py   Data access
│       └── schemas.py      Pydantic models
├── auxiliary/    Shared services (scheduler, middleware, auth)
└── main.py       App entry point
```

## Naming conventions

- **Files:** `lowercase_snake_case.py` for Python, `PascalCase.tsx` for React components, `camelCase.ts` for hooks and utilities
- **Domains:** singular noun (`task`, `habit`, `journal` not `tasks`, `habits`)
- **Router endpoints:** verb-first (`create_task`, `get_habit`, `update_focus_session`)
- **React components:** PascalCase, one per file, filename matches component name
- **TypeScript types/interfaces:** PascalCase, prefer interfaces over type aliases for object shapes

## API conventions

- REST-style: `GET` (list/read), `POST` (create), `PATCH` (update), `DELETE` (remove)
- All request/response bodies use Pydantic schemas
- Error responses follow `{ detail: string }` FastAPI convention
- Authentication via `Authorization: Bearer <token>` header (backend) or `DOPAFLOW_AUTH_TOKEN` env var (desktop)
- Desktop trusted clients bypass auth via `DOPAFLOW_TRUST_LOCAL_CLIENTS=1`

## Validation conventions

- **Backend:** Pydantic `model_validate` for incoming data, `.model_dump()` for outgoing
- **Frontend:** Zod for runtime validation of API responses
- **Shared types:** Single source in `shared/types/index.ts`, consumed by both frontend and backend

## Testing expectations

- **Backend:** pytest with domain-scoped test files under `backend/tests/`
- **Frontend:** Playwright for E2E/browser tests, Vitest for unit tests
- **Desktop:** Electron-specific tests under `desktop/`
- **Coverage:** All new backend features should have corresponding test files
- **E2E:** Playwright tests are the integration layer for frontend; mocked E2E tests run without a live backend

## CI expectations

- Every push runs `repo-hygiene.yml` (lint, format checks)
- Every tag runs `release.yml` (frontend build, backend package, desktop packaging, E2E tests)
- Backend tests should be runnable locally via `pytest` and will be added to CI explicitly

## Internal tooling / AI doc placement

AI agent instruction files, workflow notes, and development prompts live under:

```
docs/internal/           AI/dev configuration
docs/internal/ai-workflow/   LLM session artifacts and prompts
internal/                Personal scripts and archived content
```

Product-facing documentation lives at `docs/` root or is embedded in `README.md`.

## Doc placement rules

| Doc type | Location |
|---|---|
| User-facing how-to | `docs/` or `README.md` |
| Architecture | `docs/architecture-overview.md` |
| Engineering standards | `docs/engineering-standards.md` |
| Backend architecture | `docs/backend-architecture.md` |
| Release process | `docs/release-checklist.md` |
| AI/dev config | `docs/internal/` |
| LLM session artifacts | `docs/internal/ai-workflow/` |
| Personal/dev scripts | `internal/` |

## Version alignment

| Package | Current | Notes |
|---|---|---|
| React | `^18.3.1` | Align minor/patch across all packages |
| TypeScript | `^5.7.3` | Align minor/patch across all packages |
| Vite | frontend: `^7.3.2`, skinmaker: `^8.0.8` | **Known gap** — skinmaker on Vite 8 is a major version ahead; upgrade when safe |
| Electron | `^39.8.5` | Desktop only; upgrade requires compatibility testing |

When updating versions:
1. Update `package.json` with new semver range
2. Delete `package-lock.json`
3. Run `npm install` to regenerate
4. Commit both `package.json` and `package-lock.json` changes together

Do not mix `^` and `~` — prefer `^` for all packages.

## Internal vs. public boundary

- **Public:** Anything a contributor, user, or casual reviewer should see
- **Internal:** AI agent configs, personal scripts, archived notes, LLM workflow artifacts

The goal is that opening the repo root gives a clean product impression. Internal material is hidden but preserved.
