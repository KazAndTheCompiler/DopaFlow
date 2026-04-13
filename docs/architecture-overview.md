# DopaFlow Architecture Overview

## System diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Desktop Shell                        │
│                  (Electron + IPC)                       │
├──────────────┬─────────────────────┬───────────────────┤
│   Frontend   │      Backend        │    Packaged       │
│  (React +    │   (FastAPI +        │    Runtime        │
│   TypeScript)│    SQLite/Turso)     │                   │
└──────────────┴─────────────────────┴───────────────────┘
       │                │                    │
       └────────────────┼────────────────────┘
                       │
              localhost:8000 (API)
              localhost:5173 (dev)
```

## Frontend (`frontend/`)

React 18 SPA with TypeScript strict mode, Vite build, and PWA support.

**Key directories:**
- `src/surfaces/` — Route-level page components (Today, Tasks, Calendar, Focus, Journal, Settings, Search, Commands)
- `src/components/` — Shared UI components
- `src/hooks/` — Shared React hooks
- `src/api/` — API client functions
- `src/design-system/` — Design tokens, primitives, and themed components

**Entry point:** `src/main.tsx` → `App.tsx` which handles routing and hash-based navigation.

**Build:** `npm run build` produces a PWA-optimized production build.

**Testing:** Playwright E2E tests in `frontend/tests/` or inline `*.spec.ts` files.

## Backend (`backend/`)

FastAPI application with SQLite (local) or Turso (SQLite on libSQL) persistence.

**Key directories:**
- `app/domains/` — Feature domains (tasks, habits, focus, journal, calendar, alarms, review, etc.)
- `app/auxiliary/` — Shared services (scheduler, middleware, auth)
- `app/main.py` — Application entry point and router registration

**Domain structure** (each domain follows the same pattern):
```
domain/
├── router.py       # FastAPI router + endpoints
├── service.py     # Business logic
├── repository.py  # Data access
└── schemas.py     # Pydantic request/response models
```

**Testing:** pytest in `backend/tests/` with domain-scoped test files.

## Desktop (`desktop/`)

Electron shell that bundles the frontend build + packaged backend for distribution.

**Key files:**
- `main.js` — Main process entry
- `preload.js` — IPC bridge
- `runtime-*.js` — Auth and window management runtime

**Packaging:** `npm run dist:stable:linux` produces an AppImage; `npm run dist:stable:win` produces an NSIS installer.

## Shared (`shared/`)

TypeScript types and version that are used by both frontend and backend to keep contracts in sync.

- `shared/types/index.ts` — Shared type definitions
- `shared/version.ts` — Version string used across all three entry points

## Skinmaker (`skinmaker/`)

Standalone React app for creating and editing DopaFlow themes/skins. Produces JSON skin definitions consumed by the frontend skin engine.

## Obsidian Bridge

Located within the backend at `backend/app/auxiliary/vault_bridge/`. Handles bidirectional sync between DopaFlow and an Obsidian vault using Markdown daily notes and checkbox-formatted tasks.

## CI / Release

GitHub Actions workflows in `.github/workflows/`:
- `release.yml` — Builds and packages on version tags
- `repo-hygiene.yml` — Lints and checks on every push

Release flow: push `v*` tag → CI builds backend + frontend + desktop → produces AppImage + NSIS installer → publishes GitHub Release.

## Key architectural decisions

See `docs/ADR-001-canonical-command-pipeline.md` for the Packy/NLP command pipeline architecture.
