# DopaFlow v2 — Structure Map

## Directory layout

```
.
├── backend/          # FastAPI + SQLite backend
│   ├── app/
│   │   ├── core/     # config, database, scheduler
│   │   ├── domains/  # one folder per domain (router, service, repository, schemas)
│   │   └── main.py   # app factory + router registration
│   └── migrations/   # numbered .sql files (001_init.sql … 024_auth_scope_tokens.sql)
├── frontend/         # React 18 + Vite + TypeScript strict
│   ├── public/skins/ # JSON skin files + manifest.json
│   └── src/
│       ├── api/      # fetch wrappers per domain (@api/ alias)
│       ├── components/       # shared components (gamification, etc.)
│       ├── design-system/    # tokens.css, skins.css, manifest.json (@ds/ alias)
│       │   └── primitives/   # Button, Input, Modal, Toast, Skeleton …
│       ├── hooks/            # domain hooks (useTasks, useHabits …)
│       ├── shell/            # Shell, TopBar, Sidebar, NavBar
│       └── surfaces/         # one folder per nav surface (@surfaces/ alias)
├── desktop/          # Electron shell (packages backend + frontend)
│   └── main.js       # Electron main process, autoUpdater, IPC, tray
├── shared/           # Types shared across frontend and desktop
│   └── types/
│       ├── index.ts        # Task, Habit, Focus, Journal, CalendarEvent …
│       └── gamification.ts # Badge, PlayerLevel, XPEvent
└── skinmaker/        # Standalone Vite app for building custom skins
```

## Backend

**Pattern**: one folder per domain under `app/domains/`. Each domain owns its `router.py`, `service.py`, `repository.py`, and `schemas.py`. Routers are registered in `app/main.py` under `API_PREFIX = "/api/v2"`.

**Database access**: always use `get_db()` for reads and `tx()` for writes. Never call `sqlite3.connect()` directly in backend domain code — these helpers wire Turso libsql when `DOPAFLOW_TURSO_URL` is configured.

**Migrations**: numbered sequential `.sql` files in `backend/migrations/`. Run in order at startup via `run_migrations()`. No gaps allowed; use placeholder files (`SELECT 1;`) if a number is skipped.

**Scheduler**: `app/core/scheduler.py` fires recurring jobs (alarm polling, recurring task materialisation). Started in `app/main.py` lifespan.

## Frontend

**Stack**: React 18, Vite, TypeScript `strict` + `exactOptionalPropertyTypes: true`. No class components. All async side-effects go in hooks.

**Path aliases** (set in `vite.config.ts`):

| Alias | Resolves to |
|-------|-------------|
| `@ds/` | `src/design-system/` |
| `@surfaces/` | `src/surfaces/` |
| `@hooks/` | `src/hooks/` |
| `@api/` | `src/api/` |
| `@shared/` | `../shared/` |

**Surfaces**: each nav item maps 1:1 to a folder under `src/surfaces/`. Loaded lazily via `React.lazy`. The route switch lives in `App.tsx`.

**Skins**: 19 skins defined in `src/design-system/skins.css` via `[data-skin="id"]` selectors. The `useSkin` hook loads `public/skins/manifest.json` for the picker and fetches `public/skins/{id}.json` for var injection.

**Gradient Skins**: Three gradient-enabled skins (`forest-gradient`, `ocean-gradient`, `amber-night`) demonstrate the advanced gradient system. Gradient tokens add depth:
- `--bg-gradient` — Main app background (175° angle typical)
- `--sidebar-gradient` — Sidebar navigation (180° vertical)
- `--card-gradient` — Cards and panels (155-160° diagonal)
- `--surface-gradient` — Elevated surfaces (145° subtle lift)

When gradient tokens are empty, skins fall back to solid color tokens for backward compatibility.

**Never pass explicit `undefined` to optional props** — use conditional spread: `{...(value !== undefined ? { prop: value } : {})}`.

## Skinmaker

Standalone Vite app for building custom skins. Located at `skinmaker/`.

**Features:**
- Visual token editor with live preview
- 16 built-in preset skins
- Gradient token support (angle, color stops, presets)
- CSS export functionality

**Running:**
```bash
cd skinmaker
npm install
npm run dev  # → http://localhost:5173
```

**Export Workflow:**
1. Design skin in Skin Maker
2. Click "Export Skin CSS"
3. Copy generated CSS
4. Paste into `frontend/src/design-system/skins.css`
5. Add skin entry to `manifest.json` and `shared/skins.ts`

See `docs/skineditor.md` for comprehensive usage guide.

---

## Desktop

Electron wraps the frontend (served from `dist/`) and spawns the Python backend as a child process from the packaged AppImage. Communication uses IPC:

- `update-available` / `update-downloaded` → renderer shows update banner
- `install-update` → `autoUpdater.quitAndInstall()`
- `alarm-fired` → renderer shows alarm notification
- `focus-completed` → backend triggered after focus session

**Linux**: `afterPack.js` patches the AppRun exec line for SUID compatibility.

## Key environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOPAFLOW_DB_PATH` | `~/.local/share/DopaFlow/db.sqlite` | SQLite database path |
| `DOPAFLOW_EXTRA_CORS_ORIGINS` | — | Additional CORS origins (comma-separated) |
| `DOPAFLOW_DISABLE_LOCAL_AUDIO` | — | Set to `1` to skip local audio in tests |
| `DOPAFLOW_TURSO_URL` | — | libsql URL for cloud sync |
| `DOPAFLOW_TURSO_TOKEN` | — | Auth token for Turso |
| `DOPAFLOW_DEV_AUTH` | — | Set to `true` to bypass auth scope checks in dev |
| `DOPAFLOW_AUTH_TOKEN_SECRET` | — | Signing secret for remote scoped bearer tokens |

## Running locally

```bash
# Backend
cd backend
pip install -e ".[dev]"
export DOPAFLOW_DISABLE_LOCAL_AUDIO=1
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # → http://localhost:5173

# Desktop (requires backend running)
cd desktop
npm install
npm start

# Skinmaker
cd skinmaker
npm install
npm run dev
```

## Migration policy

- Files are named `NNN_description.sql` (zero-padded to 3 digits).
- Numbers must be contiguous. If a migration number is retired, replace it with a placeholder: `-- Placeholder: migration NNN was not used.\nSELECT 1;`
- All DDL uses `IF NOT EXISTS` / `IF NOT EXISTS` guards.
- Write access must go through `tx()` to ensure WAL journaling.

---

## Backend domains

### alarms
- **Files**: router.py, audio_router.py, player_router.py, service.py, repository.py, schemas.py, audio_handler.py
- **Endpoints**:
  - GET    /alarms
  - GET    /alarms/upcoming
  - POST   /alarms
  - GET    /alarms/{identifier}
  - PATCH  /alarms/{identifier}
  - DELETE /alarms/{identifier}
  - POST   /alarms/{identifier}/trigger
  - GET    /alarms/scheduler/status
  - POST   /alarms/{alarm_id}/trigger-audio
  - POST   /alarms/resolve-url

### boards
- **Files**: router.py, eisenhower.py
- **Endpoints**:
  - GET    /boards/kanban
  - GET    /boards/eisenhower
  - GET    /boards/matrix-data

### calendar
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /calendar/events
  - POST   /calendar/events
  - GET    /calendar/events/{identifier}
  - PATCH  /calendar/events/{identifier}
  - DELETE /calendar/events/{identifier}
  - POST   /calendar/google/sync
  - GET    /calendar/oauth/url
  - GET    /calendar/oauth/callback
  - GET    /calendar/sync/conflicts
  - POST   /calendar/sync/conflicts/{identifier}/resolve
  - GET    /calendar/sync/status

### focus
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /sessions
  - POST   /sessions
  - POST   /sessions/control
  - POST   /start
  - POST   /pause
  - POST   /resume
  - POST   /stop
  - POST   /complete
  - GET    /status
  - GET    /history
  - GET    /stats
  - GET    /recommendation

### gamification
- **Files**: router.py, service.py, repository.py, schemas.py, badge_engine.py, xp_engine.py
- **Endpoints**:
  - GET    /gamification/status
  - GET    /gamification/badges
  - POST   /gamification/award

### habits
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /
  - POST   /
  - GET    /today
  - GET    /weekly
  - GET    /insights
  - GET    /goals/summary
  - POST   /{identifier}/checkin
  - DELETE /{identifier}/checkin/{checkin_date}
  - GET    /{identifier}/logs
  - GET    /{identifier}/export/csv
  - PATCH  /{identifier}
  - DELETE /{identifier}
  - PATCH  /{identifier}/freeze
  - PATCH  /{identifier}/unfreeze
  - GET    /correlations

### insights
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /insights/momentum
  - GET    /insights/weekly-digest
  - GET    /insights/correlations

### integrations
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - POST   /gmail/connect
  - POST   /gmail/import
  - GET    /gmail/callback
  - POST   /webhooks/outbox
  - GET    /outbox/metrics
  - POST   /outbox/dispatch

### journal
- **Files**: router.py, templates_router.py, transcribe_router.py, service.py, repository.py, schemas.py, template_schemas.py
- **Endpoints**:
  - GET    /journal/entries
  - POST   /journal/entries
  - GET    /journal/entries/{identifier}
  - DELETE /journal/entries/{identifier}
  - GET    /journal/backup-status
  - POST   /journal/backup/trigger
  - GET    /journal/graph
  - GET    /journal/{identifier}/backlinks
  - GET    /journal/templates
  - POST   /journal/templates
  - GET    /journal/templates/{identifier}
  - DELETE /journal/templates/{identifier}
  - POST   /journal/templates/{identifier}/apply
  - POST   /journal/transcribe

### motivation
- **Files**: router.py, quotes.py
- **Endpoints**:
  - GET    /motivation/quote
  - GET    /motivation/quote/random

### notifications
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /
  - POST   /
  - POST   /{identifier}/read
  - POST   /read-all
  - POST   /{identifier}/archive
  - DELETE /{identifier}
  - GET    /unread-count

### nutrition
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - POST   /nutrition/log
  - GET    /nutrition/today
  - GET    /nutrition/history
  - GET    /nutrition/recent
  - DELETE /nutrition/{identifier}

### packy
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - POST   /packy/ask
  - GET    /packy/whisper
  - POST   /packy/lorebook
  - GET    /packy/momentum

### review
- **Files**: router.py, anki_router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /review/cards
  - GET    /review/decks
  - GET    /review/due
  - POST   /review/decks
  - POST   /review/cards
  - POST   /review/rate
  - GET    /review/decks/{deck_id}/export

### search
- **Files**: router.py, search_engine.py, schemas.py
- **Endpoints**:
  - GET    /search

### tasks
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - POST   /
  - GET    /
  - GET    /search
  - GET    /tomorrow
  - GET    /templates
  - POST   /templates
  - DELETE /templates/{identifier}
  - POST   /from-template/{identifier}
  - POST   /quick-add
  - POST   /materialize-recurring
  - POST   /bulk/complete
  - POST   /bulk/delete
  - POST   /import/csv
  - GET    /{identifier}
  - PATCH  /{identifier}
  - DELETE /{identifier}
  - PATCH  /{identifier}/complete
  - GET    /{identifier}/context
  - POST   /{identifier}/deps/{dep_id}
  - DELETE /{identifier}/deps/{dep_id}
  - POST   /{identifier}/subtasks
  - PATCH  /{identifier}/subtasks/{sub_id}
  - DELETE /{identifier}/subtasks/{sub_id}
  - POST   /{identifier}/time/start
  - POST   /{identifier}/time/stop
  - GET    /{identifier}/time

### projects
- **Files**: router.py, service.py, repository.py, schemas.py
- **Endpoints**:
  - GET    /projects
  - POST   /projects
  - GET    /projects/{identifier}
  - PATCH  /projects/{identifier}
  - DELETE /projects/{identifier}
  - PATCH  /projects/{identifier}/archive

### player
- **Files**: router.py, service.py, repository.py
- **Endpoints**:
  - POST   /player/resolve-url
  - GET    /player/queue
  - POST   /player/queue
  - POST   /player/queue/next
  - POST   /player/predownload/enqueue
  - GET    /player/predownload/status
  - POST   /player/predownload/retry/{job_id}

### commands
- **Files**: router.py
- **Endpoints**:
  - GET    /commands
  - POST   /commands
  - GET    /commands/{identifier}
  - PATCH  /commands/{identifier}
  - DELETE /commands/{identifier}
  - POST   /commands/{identifier}/run

### digest
- **Files**: router.py
- **Endpoints**:
  - GET    /digest/today
  - GET    /digest/weekly

### health
- **Files**: router.py
- **Endpoints**:
  - GET    /health/full

### meta
- **Files**: router.py, schemas.py
- **Endpoints**:
  - GET    /meta
  - GET    /meta/version
  - GET    /meta/openapi

### ops
- **Files**: router.py, schemas.py, service.py
- **Endpoints**:
  - GET    /ops/stats
  - GET    /ops/sync-status
  - GET    /ops/config
  - POST   /ops/turso-test
  - GET    /ops/export
  - GET    /ops/export/download
  - GET    /ops/export/all
  - GET    /ops/backup/db
  - POST   /ops/backup/verify
  - POST   /ops/restore/db
  - POST   /ops/seed
  - POST   /ops/import
  - POST   /ops/integrations/reconcile

---

## Frontend surfaces

### alarms
- **Main file**: index.tsx
- **Components**: AlarmAudioPlayer.tsx (shared)
- **Exported**: Alarm management and player UI

### calendar
- **Main file**: index.tsx
- **Purpose**: Calendar event display and management

### focus
- **Main file**: index.tsx
- **Purpose**: Pomodoro and deep focus session UI

### habits
- **Main file**: index.tsx
- **Purpose**: Habit tracking and weekly overview

### journal
- **Main file**: index.tsx
- **Components**: VoiceDictation.tsx, TemplatesPicker.tsx (shared)
- **Purpose**: Journal entry creation and editing

### review
- **Main file**: index.tsx
- **Components**: DeckExportButton.tsx
- **Purpose**: Spaced repetition review interface

### settings
- **Main file**: index.tsx
- **Purpose**: App configuration and preferences

### tasks
- **Main file**: index.tsx
- **Components**: TasksPanel.tsx, TaskRow.tsx, TaskCreateBar.tsx, TaskFilterBar.tsx, EisenhowerView.tsx
- **Purpose**: Task management with multiple views

### today
- **Main file**: index.tsx
- **Purpose**: Daily dashboard and overview

### overview
- **Main file**: index.tsx
- **Purpose**: Live stats, momentum gauge, Packy whisper, mood drivers, wikilink graph

### insights
- **Main file**: index.tsx
- **Purpose**: Momentum score, weekly digest, Pearson-r habit correlations

### digest
- **Main file**: index.tsx
- **Purpose**: Daily and weekly digest with activity distribution bar

### gamification
- **Main file**: index.tsx
- **Purpose**: XP bar, level badge, badge gallery

### player
- **Main file**: index.tsx
- **Purpose**: Focus music player with yt-dlp URL resolution and queue persistence

### nutrition
- **Main file**: index.tsx
- **Purpose**: Food logging, macro bars, daily kJ tracking, goals editor

### commands
- **Main file**: index.tsx
- **Purpose**: Saved Packy command macros

### search
- **Main file**: index.tsx
- **Purpose**: Cross-domain full-text search

---

## Frontend shared components

- **AlarmAudioPlayer.tsx** — Audio playback for alarm triggering
- **DailyQuote.tsx** — Motivation quote display
- **NotificationInbox.tsx** — Notification center
- **SearchBar.tsx** — Cross-domain search UI
- **TemplatesPicker.tsx** — Journal/task template selection
- **VoiceDictation.tsx** — Audio-to-text for journal entries

### gamification
- **AchievementToast.tsx** — Achievement notifications
- **BadgeCard.tsx** — Individual badge display
- **BadgeGallery.tsx** — Badge collection view
- **LevelBadge.tsx** — Player level indicator
- **XPBar.tsx** — Experience points progress bar

### review
- **DeckExportButton.tsx** — Export review decks to ZIP

---

## Shared services

- **player.py** — YouTube stream resolution (yt-dlp wrapper)
- **quick_add.py** — Natural language task parsing
- **tts.py** — Text-to-speech synthesis

---

## Database migrations (in order)

1. **001_init.sql** — Core tables (tasks, habits, focus, journal)
2. **001b_task_time_log.sql** — Task time logging
3. **002_habits.sql** — Habit tracking schema
4. **003_focus.sql** — Focus sessions and active state
5. **004_review.sql** — Spaced repetition decks and cards
6. **005_journal.sql** — Journal entries and wikilinks
7. **006_calendar.sql** — Calendar events and sync state
8. **007_alarms.sql** — Alarm scheduling and metadata
9. **008_notifications.sql** — Notification center
10. **009_nutrition.sql** — Food logging and daily totals
11. **010_integrations.sql** — OAuth tokens and webhook outbox
12. **011_packy_lorebook.sql** — Packy AI context storage
13. **012_indexes.sql** — Performance indexes
14. **013_oauth_tokens.sql** — Google OAuth token storage
15. **014_gamification.sql** — Badges, XP, and levels
16. **015_alarms_audio.sql** — Alarm audio queue
17. **016_journal_templates.sql** — Journal entry templates
18. **017_commands.sql** — Saved command macros
19. **018_ops_metadata.sql** — Key-value ops metadata store
20. **019_journal_versions.sql** — Journal entry version history
21. **020_review_sessions.sql** — Review session log enhancements
22. **021_nutrition_foods.sql** — Nutrition food library
23. **022_projects.sql** — Projects (task grouping)
24. **023_calendar_sharing.sql** — Calendar share tokens and peer feeds
25. **024_auth_scope_tokens.sql** — Registry-backed remote scope token lifecycle
