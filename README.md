# DopaFlow

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Offline First](https://img.shields.io/badge/Offline--first-no_cloud_required-6B7280?style=flat-square)](#offline-first)
[![Get on Gumroad](https://img.shields.io/badge/Stable_build-$1_on_Gumroad-FF90E8?style=flat-square&logo=gumroad&logoColor=white)](https://kirkhenrik.gumroad.com/l/woosbf)
[![License: PolyForm NC](https://img.shields.io/badge/License-PolyForm_NC_1.0-blue?style=flat-square)](LICENSE)

**A productivity app for ADHD brains — tasks, habits, focus, journaling, calendar, alarms, and spaced repetition in one offline-first surface.**

---

## What it does

DopaFlow brings tasks, habits, focus, journaling, calendar, alarms, and spaced repetition into one place without the mental overhead of bouncing between five different apps.

| Surface | What it covers |
|---|---|
| **Tasks** | Full CRUD, subtasks, priorities, time logging, Kanban & Eisenhower boards, bulk operations, natural language quick-add |
| **Habits** | Daily check-ins, streaks, freeze/unfreeze, correlation insights, progress rings, heatmap |
| **Focus** | Pomodoro sessions, task picker, custom duration, session history and stats |
| **Journal** | Markdown editor, voice dictation, wikilinks, version history, auto-export to `.md`, templates |
| **Calendar** | Events with drag-to-reschedule and resize in Day view, click-to-edit modal, recurring blocks, Google sync, peer calendar sharing |
| **Alarms** | Schedule alarms, TTS or YouTube audio queue, background service worker |
| **Review** | Spaced repetition (SM-2), Anki import, deck management, keyboard shortcuts, inline card editor |
| **Packy** | Contextual memory system to help resurface things you forgot |
| **Digest** | End of day summary, momentum score, weekly insights in plain language |
| **Gamification** | XP, badges, levels — because dopamine helps |

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + PWA
- **Backend:** FastAPI + SQLite or Turso
- **Desktop:** Electron
- **Themes:** 24 built-in skins (19 in the picker, 5 gradient variants)

---

## Repo structure

```
dopaflow/
├── backend/          FastAPI app (domains, routers, services, repositories)
├── desktop/          Electron shell for packaged desktop builds
├── frontend/         React + TypeScript SPA (surfaces, components, hooks, api)
├── shared/           Shared TypeScript types and version
├── skinmaker/        Standalone skin editor utility
├── docs/             Architecture docs, changelog, user guide
├── scripts/          Release and CI helper scripts
├── tools/            Dev tooling (MCP servers, etc.)
├── release/          Packaging output and staging
└── internal/         Personal artifacts and archived content (not product-facing)
```

For a full architecture breakdown, see [`docs/architecture-overview.md`](docs/architecture-overview.md).

---

## Status

**Best for:**
- Local self-hosting (Docker, single server)
- Single-user offline-first workflows
- Developers and contributors

**Not designed for:**
- Multi-user hosted SaaS
- Horizontal scaling across multiple servers (SQLite is single-writer)
- Zero-config enterprise deployment

**For production exposure beyond localhost:** set `DOPAFLOW_ENFORCE_AUTH=true` in your `.env` and configure a strong `DOPAFLOW_API_KEY`.

---

## Quick start

**Use this if:** you want to run DopaFlow locally and see if it fits your workflow.

### Option A — Docker (fastest, no setup)

```bash
cp .env.example .env
docker compose up --build
# open http://localhost:3000
```

Everything in one command. No Python, no Node, no manual config. The Docker path is the recommended first try.

### Option B — Local development

Two terminals:

```bash
# Terminal 1: backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn app.main:app --reload

# Terminal 2: frontend
cd frontend
npm install
npm run dev
# open http://localhost:5173
```

Frontend (`5173`) proxies `/api/*` to backend (`8000`).

### Option C — Desktop package

```bash
cd desktop
npm ci && npm test
npm run dist:stable:linux
```

Requires Python 3.11 or 3.12 and Node 18+.

### Requirements

- Node 18+
- Python 3.11 or 3.12 (run `make doctor` to verify)

---

## Development

### Repository commands

```bash
make help              # show all available commands
make dev               # start frontend dev server
make backend           # start backend dev server
make test             # run all tests (backend + frontend typecheck)
make test-backend      # run backend tests with pytest
make test-frontend    # run frontend typecheck
make test-e2e         # run frontend E2E smoke tests
make lint             # lint all projects (backend + frontend)
make lint-backend     # lint backend with ruff
make lint-frontend    # lint frontend with ESLint
make format           # format code (prettier + ruff)
make format-check     # check formatting without modifying
make validate         # run all quality checks (lint + typecheck + backend tests)
make typecheck        # TypeScript typecheck frontend
make build            # build frontend production bundle
make doctor           # check environment readiness
```

### Frontend surfaces

React-router surfaces under `frontend/src/surfaces/`: Today, Tasks, Calendar, Focus, Journal, Settings, Search, Commands.

Shared components, hooks, and API clients live under `frontend/src/`.

### Backend domains

FastAPI routers under `backend/app/domains/`. Each domain follows `router/service/repository/schemas` layering.

### Browser E2E tests

```bash
cd frontend
npm run test:e2e:smoke    # startup + navigation regression (mocked, fast)
npm run test:e2e:core     # broader mocked coverage
npm run test:e2e:release  # full release slice used in CI
```

### Backend tests

```bash
cd backend
pytest tests/ -v
```

See [`docs/backend-architecture.md`](docs/backend-architecture.md) for backend layout details.

---

## Release builds

Desktop packaging is wired through [`.github/workflows/release.yml`](.github/workflows/release.yml).

Recommended path:

- push to `main` for normal CI confidence
- push a `v*` tag to build release artifacts and publish a GitHub Release
- Linux `AppImage` artifact is the primary desktop package

Release gates include repo hygiene checks, frontend E2E coverage, desktop runtime tests, and AppImage payload verification.

For the full release checklist, see [`docs/release-checklist.md`](docs/release-checklist.md).

---

## Two versions

| | Dev (this repo) | Stable |
|---|---|---|
| **Cost** | Free | $1 |
| **Updates** | Pull manually from GitHub | Auto-updates when pushed |
| **Status** | Active development | Tested, tagged releases |
| **Support** | None | None, but issues are welcome |

👉 **[Get the stable build on Gumroad](https://kirkhenrik.gumroad.com/l/woosbf)** — $1, pay what you want above that.

---

## Offline first

Your data lives on your device. No account required. No cloud dependency. No subscription.

Optional Google Calendar sync uses OAuth. Your credentials are not baked into the app.

---

## Voice commands

Voice commands use the same preview → confirm → execute path as typed commands, without rigid prefixes.

Examples:
- `buy milk tomorrow`
- `journal today felt clearer after walking`
- `schedule dentist tomorrow at 2pm for 45 minutes`
- `start focus for 25 minutes`

---

## Known gaps (v2 beta)

- Skeleton loaders are in place on core loading-heavy surfaces; the rest still needs a consistency pass
- Obsidian bridge is manual-first: no live watch, no merge UI, no vault-wide import outside the configured task folder
- Digest delivery, scheduling, and richer coaching-style guidance are still missing
- Mobile swipe-to-complete on task rows is not implemented
- Calendar drag support is Day-view-only; Week and Month views are click-to-open
- Nutrition food library editing and search is basic
- Review APKG test coverage is improving but not yet comprehensive

---

## Obsidian bridge

DopaFlow has a local-first Obsidian vault bridge.

What it supports today:

- vault path/configuration in Settings
- journal push/pull using Markdown daily notes
- task collection push/pull using Obsidian-compatible checkbox syntax
- daily task section push into existing daily notes using bounded markers
- task import preview/import from vault task files
- rollback, conflict tracking, and conflict preview for indexed vault files

Current shape:
- journal notes: `Daily/YYYY-MM-DD.md`
- tasks: `Tasks/Inbox.md` + one `Tasks/<project>.md` per project
- DopaFlow task identity stored in hidden HTML comments (`<!--df:tsk_123-->`)
- daily-note task injection only touches the managed `dopaflow:tasks` section

What it does not do yet: live filesystem watch, cloud sync, merge UI, vault-wide import outside the configured task folder.

See [`docs/obsidian_bridge.md`](docs/obsidian_bridge.md) for workflow and compatibility rules.

---

## Why these features exist

ADHD is dopamine hunting. You build systems around that or you drown in the lack of them.

- **Smart Memory** — stores by association, not exact words. Coffee → hot drink, morning ritual, warm beverage. Built for the ADHD reality: decent long-term memory, terrible short-term memory.
- **Spaced repetition** — Anki-style SM-2 forces proper encoding. For neurodivergent people, far more useful than most schools admit.
- **Alarms with TTS** — a spoken reminder lands differently than a silent badge.
- **Tasks that roll over** — guilt-free. If you planned four hours and it took six, the task moves. That is information, not failure.
- **Calorie and habit correlation** — people often do not see their own patterns until the data is in front of them.

---

## Who this is for

Primarily people with ADHD. But also anyone with a stressful life, a bad routine, a messy brain, or a history with productivity apps that assume too much about your baseline.

This is not about masking better. It is about ownership. Accountability without guilt.

---

## Credits

Built by **Henry (KazAndTheCompiler)** — ex-navigator, AuDHD, Jutland, Denmark.

Co-authored with **[Claude](https://claude.ai)** (Anthropic) and **[MiniMax](https://www.minimax.io/)** M2.7 (MiniMax) — pair-programmed across the full stack.

---

## License

**Personal use only.** You may run, modify, and learn from this code for personal non-commercial use. Redistribution, resale, or commercial use without permission is not allowed.

For anything else, open an issue and ask.
