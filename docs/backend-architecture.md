# Backend Architecture

## Overview

FastAPI application with SQLite (local) or Turso (libSQL remote) persistence. The backend is bundled with the Electron desktop app and also runs standalone for development.

## Entry point

`backend/app/main.py` — FastAPI app factory that:
- Loads configuration from environment
- Initializes the database (SQLite or Turso)
- Registers all domain routers under `/api/v1/`
- Mounts static file serving for the PWA build
- Runs the scheduler for background tasks

## Domain layout

Each domain follows the same layered structure:

```
app/domains/<domain>/
├── router.py       # FastAPI APIRouter, endpoint definitions, auth guards
├── service.py      # Business logic, orchestrates repository calls
├── repository.py   # Data access, SQL queries via raw sqlite3 or ORM
└── schemas.py      # Pydantic BaseModel for request/response validation
```

### Active domains

- `tasks` — Task CRUD, subtasks, boards, Kanban operations
- `habits` — Habit tracking, streaks, freeze, correlation insights
- `focus` — Pomodoro sessions, task linking, session history
- `journal` — Markdown journal entries, templates, auto-tags
- `calendar` — Events, recurring blocks, Google Calendar sync
- `alarms` — Alarm scheduling, TTS, YouTube audio queue
- `review` — Spaced repetition (SM-2), Anki import, deck management
- `nutrition` — Food logging, calorie tracking, habit correlation
- `gamification` — XP, badges, levels
- `search` — Full-text search across tasks, journal, habits
- `goals` — Goal tracking and progress
- `integrations` — Gmail, GitHub, webhooks, Obsidian health
- `ops` — System operations, sync, health checks
- `player` — Media playback (YouTube audio queue)
- `packy` — Contextual memory, NLP command processing

### Auxiliary services

```
app/auxiliary/
├── scheduler.py      # Background task scheduler (apscheduler)
├── middleware.py      # Auth middleware, CORS, rate limiting
├── auth.py            # Token validation, scope checking
├── config.py          # Environment config loading
└── vault_bridge/      # Obsidian vault sync service
```

## Persistence

- **Local dev:** SQLite via `sqlite3` stdlib, DB file path from `DOPAFLOW_DB_PATH`
- **Remote:** Turso via `libsql-client-ts`, connection URL from `TURSO_URL` + `TURSO_AUTH_TOKEN`
- Migrations managed via SQL scripts in `backend/migrations/`
- Repository layer abstracts the DB engine for testability

## Configuration

Environment variables (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DOPAFLOW_AUTH_TOKEN` | Desktop auth token |
| `DOPAFLOW_TRUST_LOCAL_CLIENTS` | Bypass auth for desktop clients |
| `DOPAFLOW_DB_PATH` | SQLite file path |
| `TURSO_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `DOPAFLOW_GOOGLE_OAUTH_*` | Google Calendar OAuth |
| `DOPAFLOW_DISCORD_*` | Discord webhook |
| `DOPAFLOW_DOPPLER_*` | Doppler secrets |
| `DOPAFLOW_RATE_LIMIT_DISABLED` | Disable rate limiting for testing |

## Testing

Test files under `backend/tests/` mirror the domain layout:

```
backend/tests/
├── test_tasks.py
├── test_habits.py
├── test_focus.py
├── test_journal.py
├── test_calendar.py
├── test_alarms.py
├── test_review.py
├── test_nutrition.py
├── test_gamification.py
├── test_packy.py
├── test_nlp.py
├── test_commands.py
├── vault_bridge/
│   ├── test_sync_service.py
│   ├── test_task_writer.py
│   └── ...
└── conftest.py  # Shared fixtures
```

Run with: `cd backend && pytest tests/ -v`

## API versioning

All API routes are prefixed with `/api/v1/` via the router registration in `main.py`.

## Background scheduler

`apscheduler` handles recurring tasks (digest delivery, habit streak checks, alarm polling). The scheduler is started in `main.py` on app startup.

## Auth flow

1. Desktop sets `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` which bypasses token validation
2. Web clients send `Authorization: Bearer <token>` header
3. Middleware extracts and validates token against `DOPAFLOW_AUTH_TOKEN`
4. Invalid/missing token returns 401

## Desktop packaging

The backend is packaged with PyInstaller into a single executable via `backend/dopaflow-backend.spec`. The desktop app starts it as a child process and communicates via localhost HTTP.
