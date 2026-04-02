# DopaFlow v2 — Complete Developer Reference

**Version:** 2.0.0-beta
**Last Updated:** March 31, 2026
**Purpose:** Comprehensive file reference for AI assistants and new developers joining the project

---

## Quick Start for AI Assistants

If you are an AI assistant reading this for the first time:

1. **This is a monorepo** with multiple apps: DopaFlow v2 (main), ZoesCal (calendar), ZoesJournal (mobile journal)
2. **v2 is the active development branch** — this IS the v2 codebase at root
3. **Stack:** FastAPI backend + React 18 frontend + Electron desktop
4. **Database:** SQLite (local) with optional Turso cloud sync
5. **Key principle:** Local-first, no user accounts, no cloud required

### Working Directory Setup

```bash
# Always confirm you're in the right directory
pwd
# Should end with: /dopaflow

# For backend work:
cd backend
export ZOESTM_DISABLE_LOCAL_AUDIO=1  # Required for tests

# For frontend work:
cd frontend

# For desktop work:
cd desktop
```

---

## Table of Contents

1. [Repository Structure](#repository-structure)
2. [Backend Reference](#backend-reference)
3. [Frontend Reference](#frontend-reference)
4. [Desktop Reference](#desktop-reference)
5. [Shared Types](#shared-types)
6. [Skin Maker](#skin-maker)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Environment Variables](#environment-variables)
10. [Common Tasks](#common-tasks)

---

## Repository Structure

```
/home/henry/vscode/build/dopaflow/
├── backend/                 # FastAPI + SQLite backend
│   ├── app/
│   │   ├── core/           # config, database, scheduler
│   │   ├── domains/        # one folder per domain (router, service, repository, schemas)
│   │   ├── middleware/     # auth, CORS, rate limiting, security
│   │   ├── services/       # shared services (quick_add, player, tts)
│   │   └── main.py         # app factory + router registration
│   ├── migrations/         # numbered .sql files (001_init.sql … 024_auth_scope_tokens.sql)
│   └── tests/              # pytest test suite
│
├── frontend/                # React 18 + Vite + TypeScript strict
│   ├── public/skins/       # JSON skin files + manifest.json
│   └── src/
│       ├── api/            # fetch wrappers per domain (@api/ alias)
│       ├── components/     # shared components (gamification, etc.)
│       ├── design-system/  # tokens.css, skins.css, manifest.json (@ds/ alias)
│       │   └── primitives/ # Button, Input, Modal, Toast, Skeleton …
│       ├── hooks/          # domain hooks (useTasks, useHabits …)
│       ├── shell/          # Shell, TopBar, Sidebar, NavBar
│       └── surfaces/       # one folder per nav surface (@surfaces/ alias)
│
├── desktop/                 # Electron shell (packages backend + frontend)
│   └── main.js             # Electron main process, autoUpdater, IPC, tray
│
├── shared/                  # Types shared across frontend and desktop
│   └── types/
│       ├── index.ts        # Task, Habit, Focus, Journal, CalendarEvent …
│       └── gamification.ts # Badge, PlayerLevel, XPEvent
│
├── skinmaker/               # Standalone Vite app for building custom skins
│
├── docs/                    # Documentation
│   ├── filelist.md         # This file — complete file reference
│   └── api-reference.md    # API endpoint documentation
│
├── CLAUDE.md                # Project context for AI assistants
├── STRUCTURE.md             # Architecture reference
├── next_step.md             # Development roadmap
├── next_step_2.md           # Additional roadmap
├── V1_VS_V2.md              # v1 vs v2 comparison
├── summary.md               # High-level summary
└── ARD_compliance.md        # Architecture Decision Records compliance
```

---

## Backend Reference

### Entry Point

**File:** `backend/app/main.py`

**Purpose:** FastAPI application factory

**Key Functions:**
- `create_app()` — Creates FastAPI instance with all middleware and routers
- `lifespan()` — Manages startup/shutdown (database migrations, scheduler)

**Mounted Routes:**
```python
/api/v2/tasks           # Task management
/api/v2/projects        # Project grouping
/api/v2/habits          # Habit tracking
/api/v2/focus           # Focus sessions
/api/v2/review          # Spaced repetition
/api/v2/journal         # Journal entries
/api/v2/calendar        # Calendar events
/api/v2/alarms          # Alarm scheduling
/api/v2/gamification    # XP and badges
/api/v2/insights        # Productivity analytics
/api/v2/packy           # Memory support
/api/v2/nutrition       # Food logging
/api/v2/notifications   # Notification center
/api/v2/search          # Global search
/api/v2/health          # Health check
```

**Middleware Stack:**
1. `SecurityHeadersMiddleware` — CSP, X-Frame-Options, etc.
2. `RequestLogMiddleware` — HTTP request logging
3. `RateLimitMiddleware` — API rate limiting
4. `AuthMiddleware` — Token authentication (optional in dev)
5. `CORSMiddleware` — Cross-origin requests

---

### Core Modules

#### Configuration
**File:** `backend/app/core/config.py`

**Environment Variables:**
```python
Settings:
  db_path: str = "~/.local/share/DopaFlow/db.sqlite"
  turso_url: str | None = None  # Optional cloud sync
  turso_token: str | None = None
  extra_cors_origins: str = ""
  dev_auth: bool = False  # Bypass auth in dev
  auth_token_secret: str | None = None  # Signing secret for remote scoped bearer tokens
```

**Usage:**
```python
from app.core.config import get_settings
settings = get_settings()
```

---

#### Database
**File:** `backend/app/core/database.py`

**Key Functions:**
```python
get_db() -> sqlite3.Connection     # Get connection (read operations)
tx() -> ContextManager             # Transaction context (write operations)
run_migrations() -> None           # Execute pending migrations
```

**Important:** Never use `sqlite3.connect()` directly. Always use `get_db()` for reads and `tx()` for writes.

**Example:**
```python
# Read operation
def get_task(db: sqlite3.Connection, task_id: str) -> dict:
    row = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return dict(row) if row else None

# Write operation
def create_task(task_data: dict) -> dict:
    with tx() as db:
        db.execute("INSERT INTO tasks (...) VALUES (...)", task_data)
        db.commit()
```

---

#### ID Generation
**File:** `backend/app/core/id_gen.py`

**Purpose:** Generate prefixed UUIDs for type safety

**Prefixes:**
```python
tsk_  # Tasks
hab_  # Habits
foc_  # Focus sessions
rev_  # Review cards
jrn_  # Journal entries
evt_  # Calendar events
alm_  # Alarms
ntf_  # Notifications
prj_  # Projects
```

**Usage:**
```python
from app.core.id_gen import generate_id
task_id = generate_id("tsk")  # Returns: tsk_abc123...
```

---

#### Migrations
**Directory:** `backend/migrations/`

**Files:** Sequential SQL files (001_init.sql → 024_auth_scope_tokens.sql)

**Policy:**
- Numbers must be contiguous (no gaps)
- Use `IF NOT EXISTS` guards
- If a number is retired, create placeholder: `SELECT 1;`

**Example Migration:**
```sql
-- 001_init.sql
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    due_at TEXT,
    priority INTEGER DEFAULT 3,
    status TEXT DEFAULT 'todo',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

#### Scheduler
**File:** `backend/app/core/scheduler.py`

**Purpose:** Background jobs with APScheduler

**Scheduled Jobs:**
- Journal backup sync (nightly)
- Recurring task materialization (daily)
- Habit streak calculations (hourly)
- Notification cleanup (weekly)

---

### Domain Structure

Each domain follows this pattern:

```
backend/app/domains/{domain}/
├── router.py       # FastAPI endpoints
├── service.py      # Business logic
├── repository.py   # Data access layer
└── schemas.py      # Pydantic models
```

**Example: Tasks Domain**

**router.py:**
```python
from fastapi import APIRouter
from app.core.database import tx
from . import repository, service

router = APIRouter()

@router.post("/")
def create_task(task: TaskCreate):
    with tx() as db:
        return repository.create_task(db, task)

@router.get("/")
def list_tasks(done: bool = False, limit: int = 100):
    db = get_db()
    return repository.list_tasks(db, done=done, limit=limit)
```

**repository.py:**
```python
def create_task(db: sqlite3.Connection, task: TaskCreate) -> dict:
    task_id = generate_id("tsk")
    db.execute(
        "INSERT INTO tasks (id, title, description, ...) VALUES (?, ?, ?, ...)",
        (task_id, task.title, task.description, ...)
    )
    db.commit()
    return get_task(db, task_id)
```

**service.py:**
```python
def complete_task(db: sqlite3.Connection, task_id: str) -> dict:
    # Business logic: gamification, notifications, etc.
    task = repository.get_task(db, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    
    # Award XP for completion
    from app.domains.gamification.service import award_xp
    award_xp(db, source="task_completed", source_id=task_id, xp=10)
    
    return repository.complete_task(db, task_id)
```

**schemas.py:**
```python
from pydantic import BaseModel
from datetime import datetime

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: datetime | None = None
    priority: int = 3
    estimated_minutes: int | None = None

class Task(TaskCreate):
    id: str
    status: str
    done: bool
    created_at: datetime
    updated_at: datetime
```

---

### All Backend Domains

| Domain | Router File | Key Endpoints |
|--------|-------------|---------------|
| tasks | `app/domains/tasks/router.py` | CRUD, quick-add, bulk ops, templates, time tracking |
| projects | `app/domains/projects/router.py` | CRUD, archive |
| habits | `app/domains/habits/router.py` | CRUD, check-ins, streaks, insights |
| focus | `app/domains/focus/router.py` | Sessions, control, stats, recommendations |
| review | `app/domains/review/router.py` | Decks, cards, SRS rating, export |
| journal | `app/domains/journal/router.py` | Entries, templates, transcription, backup |
| calendar | `app/domains/calendar/router.py` | Events, Google sync, conflict resolution |
| alarms | `app/domains/alarms/router.py` | CRUD, scheduling, audio triggers |
| gamification | `app/domains/gamification/router.py` | Status, badges, XP awards |
| insights | `app/domains/insights/router.py` | Momentum, correlations, weekly digest |
| nutrition | `app/domains/nutrition/router.py` | Food logging, goals, summary |
| packy | `app/domains/packy/router.py` | Memory support, whispers, lorebook |
| notifications | `app/domains/notifications/router.py` | Inbox, read/archive, unread count |
| search | `app/domains/search/router.py` | Cross-domain search |
| boards | `app/domains/boards/router.py` | Kanban, Eisenhower matrix |
| digest | `app/domains/digest/router.py` | Daily/weekly summaries |
| commands | `app/domains/commands/router.py` | Command palette, macros |
| player | `app/domains/player/router.py` | Media playback, queue |
| integrations | `app/domains/integrations/router.py` | Gmail, GitHub, webhooks |
| health | `app/domains/health/router.py` | Health checks |
| meta | `app/domains/meta/router.py` | App metadata, version |
| ops | `app/domains/ops/router.py` | Export, backup, restore, seed |
| motivation | `app/domains/motivation/router.py` | Motivational quotes |

---

## Frontend Reference

### Entry Points

**File:** `frontend/index.html`

**Purpose:** HTML entry point with Vite bundling

**Key Elements:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DopaFlow v2</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

**File:** `frontend/src/main.tsx`

**Purpose:** React application mount

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./design-system/tokens.css";
import "./design-system/typography.css";
import "./design-system/skins.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

### App Component

**File:** `frontend/src/App.tsx`

**Purpose:** Main application with routing and state

**Navigation Items:**
```tsx
const NAV_ITEMS = [
  { id: "plan", label: "Plan day", icon: "☀" },
  { id: "today", label: "Today", icon: "◐" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "board", label: "Board", icon: "▣" },
  { id: "search", label: "Search", icon: "🔍" },
  { id: "habits", label: "Habits", icon: "◎" },
  { id: "focus", label: "Focus", icon: "◴" },
  { id: "review", label: "Review", icon: "✦" },
  { id: "journal", label: "Journal", icon: "✎" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "alarms", label: "Alarms", icon: "⚠️" },
  { id: "nutrition", label: "Nutrition", icon: "🥗" },
  { id: "digest", label: "Digest", icon: "📊" },
  { id: "player", label: "Player", icon: "♪" },
  { id: "overview", label: "Overview", icon: "◈" },
  { id: "gamification", label: "Gamify", icon: "🏆" },
  { id: "insights", label: "Insights", icon: "◉" },
  { id: "commands", label: "Commands", icon: "⚡" },
  { id: "shutdown", label: "Shutdown", icon: "🌙" },
  { id: "settings", label: "Settings", icon: "⚙" },
];
```

**Route Switch:**
```tsx
function App() {
  const [current, setCurrent] = useState("today");

  const renderSurface = () => {
    switch (current) {
      case "tasks": return <TasksView />;
      case "habits": return <HabitsView />;
      case "focus": return <FocusView />;
      // ... etc
      default: return <TodayView />;
    }
  };

  return (
    <AppDataContext.Provider value={appData}>
      <Shell current={current} onChange={setCurrent}>
        <Suspense fallback={<Loading />}>{renderSurface()}</Suspense>
      </Shell>
    </AppDataContext.Provider>
  );
}
```

---

### Path Aliases

**File:** `frontend/vite.config.ts`

**Configuration:**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      "@ds": path.resolve(__dirname, "src/design-system"),
      "@surfaces": path.resolve(__dirname, "src/surfaces"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@api": path.resolve(__dirname, "src/api"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
```

**Usage:**
```tsx
import { Button } from "@ds/primitives/Button";
import { useTasks } from "@hooks/useTasks";
import { listTasks } from "@api/tasks";
import type { Task } from "@shared/types";
```

---

### Design System

**Directory:** `frontend/src/design-system/`

**Files:**
- `tokens.css` — Base CSS variables (spacing, radius, shadows)
- `typography.css` — Font families, sizes, weights
- `skins.css` — 19 skin definitions (including 3 gradient skins)
- `manifest.json` — Skin metadata for picker
- `primitives/` — Reusable UI components (Button, Input, Modal, Toast, Card)

**Skins:**
```css
[data-skin="warm-analog"]      /* Default - earthy browns */
[data-skin="midnight-neon"]    /* Dark with cyan accent */
[data-skin="paper-minimal"]    /* Clean white */
[data-skin="aurora"]           /* Soft teal */
[data-skin="high-contrast"]    /* Black and white */
[data-skin="amber-terminal"]   /* Amber on black */
[data-skin="soft-pastel"]      /* Light pastels */
[data-skin="glassy-modern"]    /* Dark with transparency */
[data-skin="ink-and-stone"]    /* Warm gray */
[data-skin="lush-forest"]      /* Deep greens */
[data-skin="vampire-romance"]  /* Dark reds */
[data-skin="deep-ocean"]       /* Navy blues */
[data-skin="sunset-blues"]     /* Purple-blues */
[data-skin="classic-noir"]     /* Black and gold */
[data-skin="cotton-candy"]     /* Light purples */
[data-skin="neon-punk"]        /* Dark with neon purple */
[data-skin="forest-gradient"]  /* Gradient skin */
[data-skin="ocean-gradient"]   /* Gradient skin */
[data-skin="amber-night"]      /* Gradient skin */
```

**Gradient Tokens:**
```css
--bg-gradient: linear-gradient(175deg, #111e14 0%, #1a2e1e 100%);
--sidebar-gradient: linear-gradient(180deg, #0e1a11 0%, #1a2e1e 100%);
--card-gradient: linear-gradient(155deg, #2e4035 0%, #243329 100%);
--surface-gradient: linear-gradient(145deg, #2a3d2e 0%, #253a2c 100%);
```

---

### Surfaces (Views)

**Directory:** `frontend/src/surfaces/`

Each surface is a lazy-loaded route:

| Surface | File | Purpose |
|---------|------|---------|
| today | `surfaces/today/index.tsx` | Daily dashboard |
| tasks | `surfaces/tasks/index.tsx` | Task management |
| habits | `surfaces/habits/index.tsx` | Habit tracking |
| focus | `surfaces/focus/index.tsx` | Focus sessions |
| review | `surfaces/review/index.tsx` | Spaced repetition |
| journal | `surfaces/journal/index.tsx` | Journal entries |
| calendar | `surfaces/calendar/index.tsx` | Calendar view |
| alarms | `surfaces/alarms/index.tsx` | Alarm management |
| nutrition | `surfaces/nutrition/index.tsx` | Food logging |
| digest | `surfaces/digest/index.tsx` | Daily/weekly digest |
| player | `surfaces/player/index.tsx` | Media player |
| overview | `surfaces/overview/index.tsx` | Overview dashboard |
| gamification | `surfaces/gamification/index.tsx` | XP and badges |
| insights | `surfaces/insights/index.tsx` | Analytics |
| commands | `surfaces/commands/index.tsx` | Command palette |
| search | `surfaces/search/index.tsx` | Search interface |
| settings | `surfaces/settings/index.tsx` | App settings |
| plan | `surfaces/plan/PlanMyDayModal.tsx` | Plan day modal |
| shutdown | `surfaces/shutdown/ShutdownModal.tsx` | End-of-day modal |
| onboarding | `surfaces/onboarding/OnboardingModal.tsx` | First-time onboarding |

---

### API Layer

**Directory:** `frontend/src/api/`

**Base URL:** `http://127.0.0.1:8000/api/v2` (configurable)

**Example API Client:**
```typescript
// api/tasks.ts
import type { Task } from "@shared/types";
import { apiClient } from "./client";

export async function listTasks(params?: {
  done?: boolean;
  limit?: number;
  sort_by?: string;
}): Promise<Task[]> {
  return apiClient<Task[]>("/tasks", { params });
}

export async function createTask(task: Partial<Task>): Promise<Task> {
  return apiClient<Task>("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export async function updateTask(
  id: string,
  patch: Partial<Task>
): Promise<Task> {
  return apiClient<Task>(`/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
```

**API Client Utility:**
```typescript
// api/client.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v2";

export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, any> }
): Promise<T> {
  const url = new URL(endpoint, API_BASE_URL);
  if (options?.params) {
    Object.entries(options.params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || "Request failed");
  }

  return response.json();
}
```

---

### Hooks

**Directory:** `frontend/src/hooks/`

| Hook | Purpose | Returns |
|------|---------|---------|
| `useTasks` | Task state management | tasks, filters, actions |
| `useHabits` | Habit state | habits, check-ins, streaks |
| `useFocus` | Focus sessions | session, controls, stats |
| `useReview` | Review cards | cards, decks, rating |
| `useJournal` | Journal entries | entries, templates, graph |
| `useCalendar` | Calendar events | events, sync status |
| `useAlarms` | Alarm management | alarms, triggers |
| `usePacky` | Memory support | whisper, ask, momentum |
| `useInsights` | Analytics | momentum, correlations |
| `useNotifications` | Notifications | inbox, unread count |
| `useGamification` | XP and badges | level, badges, awards |
| `useSkin` | Theme management | current skin, picker |
| `useProjects` | Project state | projects, actions |
| `useCommandBar` | Command palette | commands, execution |
| `useKeyboardShortcuts` | Global shortcuts | shortcut registration |

**Example Hook:**
```typescript
// hooks/useTasks.ts
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState<TaskFilters>({ done: false });
  const [sortBy, setSortBy] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listTasks(filters).then(setTasks).finally(() => setLoading(false));
  }, [filters]);

  const complete = async (id: string) => {
    await updateTask(id, { done: true });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: true } : t));
  };

  return {
    tasks,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    loading,
    complete,
    // ... other actions
  };
}
```

---

## Desktop Reference

**Directory:** `desktop/`

**Purpose:** Electron wrapper that packages backend + frontend

### Main Process

**File:** `desktop/main.js`

**Key Features:**
- Spawns Python backend as child process
- Manages browser window lifecycle
- Handles auto-updates
- System tray integration
- Global keyboard shortcuts
- Native notifications
- IPC communication with renderer

**Backend Runtime:**
```javascript
const { BackendRuntime } = require("./backend-runtime");

class DesktopApp {
  constructor() {
    this.backend = new BackendRuntime({
      pythonPath: path.join(__dirname, "python-embedded"),
      backendPath: path.join(__dirname, "backend"),
      dbPath: getUserDataPath("v2.db"),
    });
  }

  async start() {
    await this.backend.start();
    this.createWindow();
    this.setupAutoUpdater();
    this.setupSystemTray();
    this.setupGlobalShortcuts();
  }
}
```

**Auto-Updater:**
```javascript
const { autoUpdater } = require("electron-updater");

autoUpdater.on("update-available", (info) => {
  mainWindow.webContents.send("df:update-available", { version: info.version });
});

autoUpdater.on("update-downloaded", () => {
  mainWindow.webContents.send("df:update-downloaded");
});

ipcMain.on("df:install-update", () => {
  autoUpdater.quitAndInstall();
});
```

---

### Preload Script

**File:** `desktop/preload.js`

**Purpose:** Secure IPC bridge between main and renderer

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  platform: process.platform,
  ipcRenderer: {
    send: (channel, data) => ipcRenderer.send(channel, data),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    },
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  },
});
```

---

### Build Configuration

**File:** `desktop/electron-builder.yml`

**Targets:**
```yaml
linux:
  target: AppImage
  category: Productivity
mac:
  target: dmg
  category: public.app-category.productivity
win:
  target:
    - nsis
    - msi
```

**Files to Include:**
```yaml
files:
  - main.js
  - preload.js
  - backend-runtime.js
  - afterPack.js
  - dist/  # Frontend build
  - backend/  # Packaged Python backend
```

---

## Shared Types

**Directory:** `shared/types/`

**File:** `index.ts`

**Purpose:** TypeScript types shared between frontend and desktop

**ID Types:**
```typescript
type TaskId = `tsk_${string}`;
type HabitId = `hab_${string}`;
type FocusId = `foc_${string}`;
type ReviewId = `rev_${string}`;
type JournalId = `jrn_${string}`;
type EventId = `evt_${string}`;
type NotificationId = `ntf_${string}`;
type AlarmId = `alm_${string}`;
type ProjectId = `prj_${string}`;
```

**Core Interfaces:**
```typescript
interface Task {
  id: TaskId;
  title: string;
  description?: string | null;
  due_at?: string | null;
  priority: number;  // 1-4
  status: "todo" | "in_progress" | "done" | "cancelled";
  done: boolean;
  estimated_minutes?: number | null;
  actual_minutes?: number | null;
  recurrence_rule?: string | null;
  subtasks: SubTask[];
  tags: string[];
  project_id?: ProjectId | null;
  created_at: string;
  updated_at: string;
}

interface Habit {
  id: HabitId;
  name: string;
  target_freq: number;
  target_period: "day" | "week" | "month";
  color: string;
  freeze_until?: string | null;
  current_streak: number;
  best_streak: number;
}

interface FocusSession {
  id: FocusId;
  task_id?: TaskId | null;
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number;
  status: "active" | "paused" | "completed" | "abandoned";
}

interface JournalEntry {
  id: JournalId;
  markdown_body: string;
  emoji?: string | null;
  date: string;
  tags: string[];
  version: number;
  locked?: boolean;
}

interface CalendarEvent {
  id: EventId;
  title: string;
  description?: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  category?: string | null;
  sync_status: "local_only" | "pending_sync" | "synced" | "conflict" | "error";
}
```

**Gamification Types:**
```typescript
interface PlayerLevel {
  level: number;
  total_xp: number;
  xp_to_next: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned_at?: string;
}

interface XPEvent {
  id: string;
  source: string;
  source_id?: string;
  xp: number;
  created_at: string;
}
```

---

## Skin Maker

**Directory:** `skinmaker/`

**Purpose:** Standalone visual editor for creating custom skins

### Running Skin Maker

```bash
cd skinmaker
npm install
npm run dev  # Opens at http://localhost:5173
```

### Features

- **Live Preview:** Real-time mock application UI
- **16 Presets:** Built-in professionally designed skins
- **Gradient Support:** Angle picker, color stops, presets
- **Export:** One-click CSS generation

### Token Groups

1. **Background & Surface** — `--bg-app`, `--surface`, `--surface-2`, `--border`
2. **Text & Muted** — `--text`, `--text-muted`, `--text-inverted`, `--text-link`
3. **Accent & Interactive** — `--accent`, `--accent-soft`, `--focus-ring`, shadows
4. **States & Indicators** — `--state-completed`, `--state-overdue`, `--state-conflict`, etc.
5. **Calendar & Events** — `--timeline-now`, `--calendar-grid-line`, `--event-default`, etc.
6. **Gradient (Optional)** — `--bg-gradient`, `--sidebar-gradient`, `--card-gradient`, `--surface-gradient`

### Export Workflow

1. Design skin in Skin Maker
2. Click "Export Skin CSS"
3. Copy generated CSS
4. Paste into `frontend/src/design-system/skins.css`
5. Add entry to `manifest.json`
6. Update `shared/types/skins.ts` if needed

**See:** `docs/skineditor.md` for comprehensive guide

---

## API Endpoints

Full API reference at `docs/api-reference.md`

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks` | List tasks |
| POST | `/tasks` | Create task |
| GET | `/tasks/{id}` | Get task |
| PATCH | `/tasks/{id}` | Update task |
| DELETE | `/tasks/{id}` | Delete task |
| PATCH | `/tasks/{id}/complete` | Mark complete |
| POST | `/tasks/quick-add` | Natural language create |
| GET | `/tasks/templates` | List templates |
| POST | `/tasks/from-template/{id}` | Create from template |

### Habits

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/habits` | List habits |
| POST | `/habits` | Create habit |
| GET | `/habits/today` | Today's habits |
| POST | `/habits/{id}/checkin` | Log completion |
| GET | `/habits/insights` | Habit insights |

### Focus

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/focus/sessions` | Start session |
| POST | `/focus/sessions/control` | Control (pause/resume/stop) |
| GET | `/focus/status` | Current session |
| GET | `/focus/stats` | Statistics |

### Journal

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/journal/entries` | List entries |
| POST | `/journal/entries` | Create entry |
| GET | `/journal/graph` | Wikilink graph |
| POST | `/journal/transcribe` | Voice transcription |
| GET | `/journal/backup-status` | Backup status |

### Review

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/review/cards` | List cards |
| GET | `/review/decks` | List decks |
| POST | `/review/rate` | Rate card (SRS) |
| GET | `/review/decks/{id}/export` | Export deck |

### Calendar

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar/events` | List events |
| POST | `/calendar/events` | Create event |
| POST | `/calendar/google/sync` | Trigger sync |
| GET | `/calendar/sync/conflicts` | List conflicts |
| POST | `/calendar/sync/conflicts/{id}/resolve` | Resolve conflict |

### Alarms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/alarms` | List alarms |
| POST | `/alarms` | Create alarm |
| POST | `/alarms/{id}/trigger` | Trigger alarm |
| POST | `/alarms/{id}/trigger-audio` | Play audio |

### Gamification

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/gamification/status` | Player status |
| GET | `/gamification/badges` | All badges |
| POST | `/gamification/award` | Award XP |

### Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/insights/momentum` | Momentum score |
| GET | `/insights/weekly-digest` | Weekly summary |
| GET | `/insights/correlations` | Habit correlations |

---

## Database Schema

### Core Tables

**tasks:**
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,              -- tsk_{uuid}
    title TEXT NOT NULL,
    description TEXT,
    due_at TEXT,                       -- ISO 8601
    priority INTEGER DEFAULT 3,        -- 1 (highest) to 4
    status TEXT DEFAULT 'todo',
    done INTEGER DEFAULT 0,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    recurrence_rule TEXT,
    recurrence_parent_id TEXT,
    sort_order INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',            -- JSON array
    project_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**habits:**
```sql
CREATE TABLE habits (
    id TEXT PRIMARY KEY,              -- hab_{uuid}
    name TEXT NOT NULL,
    target_freq INTEGER DEFAULT 1,
    target_period TEXT DEFAULT 'day',
    color TEXT,
    freeze_until TEXT,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**focus_sessions:**
```sql
CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY,              -- foc_{uuid}
    task_id TEXT REFERENCES tasks(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**journal_entries:**
```sql
CREATE TABLE journal_entries (
    id TEXT PRIMARY KEY,              -- jrn_{uuid}
    markdown_body TEXT NOT NULL,
    emoji TEXT,
    entry_date TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    version INTEGER DEFAULT 1,
    locked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**calendar_events:**
```sql
CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,              -- evt_{uuid}
    title TEXT NOT NULL,
    description TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER DEFAULT 0,
    category TEXT,
    sync_status TEXT DEFAULT 'local_only',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**review_cards:**
```sql
CREATE TABLE review_cards (
    id TEXT PRIMARY KEY,              -- rev_{uuid}
    deck_id TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    interval INTEGER DEFAULT 0,
    ease_factor REAL DEFAULT 2.5,
    next_review_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**gamification:**
```sql
CREATE TABLE player_level (
    id TEXT PRIMARY KEY DEFAULT 'default',
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1
);

CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    earned_at TEXT,
    player_id TEXT DEFAULT 'default'
);

CREATE TABLE xp_ledger (
    id TEXT PRIMARY KEY,
    player_id TEXT DEFAULT 'default',
    xp_delta INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Environment Variables

### Backend

| Variable | Default | Purpose |
|----------|---------|---------|
| `DOPAFLOW_DB_PATH` | `~/.local/share/DopaFlow/db.sqlite` | SQLite database path |
| `DOPAFLOW_TURSO_URL` | `null` | Turso cloud sync URL |
| `DOPAFLOW_TURSO_TOKEN` | `null` | Turso auth token |
| `DOPAFLOW_DEV_AUTH` | `false` | Bypass auth in development |
| `DOPAFLOW_AUTH_TOKEN_SECRET` | `null` | Signing secret for remote scoped bearer tokens |
| `ZOESTM_DISABLE_LOCAL_AUDIO` | `null` | Set to `1` to disable audio |
| `DOPAFLOW_EXTRA_CORS_ORIGINS` | `""` | Additional CORS origins |
| `DOPAFLOW_JOURNAL_BACKUP_DIR` | `~/.local/share/DopaFlow/journal-backup` | Journal backup path |

### Frontend

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://127.0.0.1:8000/api/v2` | Backend API URL |

### Desktop

| Variable | Default | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `development` | Node environment |
| `DOPAFLOW_AUTO_UPDATE` | `true` | Enable auto-updates |

---

## Common Tasks

### Running Backend

```bash
cd backend
pip install -e ".[dev]"
export ZOESTM_DISABLE_LOCAL_AUDIO=1
uvicorn app.main:app --reload --port 8000
```

### Running Frontend

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173
```

### Running Desktop

```bash
cd desktop
npm install
npm start  # Requires backend running
```

### Running Skin Maker

```bash
cd skinmaker
npm install
npm run dev  # http://localhost:5173
```

### Running Tests

```bash
# Backend tests
cd backend
pytest -xvs

# Frontend type check
cd frontend
npx tsc --noEmit
```

### Building for Production

```bash
# Backend
cd backend
bash build_backend.sh

# Frontend
cd frontend
npm run build

# Desktop
cd desktop
npm run build
```

### Database Operations

```bash
# Export database
curl http://localhost:8000/api/v2/ops/export/download -o backup.json

# Restore database
curl -X POST -H "Content-Type: application/json" \
  -d @backup.json http://localhost:8000/api/v2/ops/restore/db

# Seed sample data
curl -X POST http://localhost:8000/api/v2/ops/seed
```

---

## Documentation Files

| File | Purpose |
|------|---------|
| `STRUCTURE.md` | Architecture reference |
| `docs/filelist.md` | This file — complete file reference |
| `docs/api-reference.md` | API endpoint documentation |
| `docs/skineditor.md` | Skin Maker user guide |
| `docs/security.md` | Security documentation |
| `next_step.md` | Development roadmap |
| `README.md` | v2 overview |
| `V1_VS_V2.md` | v1 vs v2 comparison |
| `summary.md` | High-level summary |

---

## Architecture Decision Records (ADRs)

Located in `zoescal/shared/decisions/`:

| ADR | Title | Status |
|-----|-------|--------|
| 0001 | ZoesCal/ZoesTM Split | Accepted |
| 0002 | Stable ID Strategy | Accepted |
| 0003 | Sync Conflict Resolution | Partially Implemented |
| 0004 | ZoesCal Skin Token Architecture | Accepted |
| 0005 | External Calendar Editability | Accepted |
| 0006 | TypeScript Strict Migration | Accepted |
| 0007 | Universal Skin System | Accepted |
| 0008 | Electron Desktop & Public Release | Accepted |
| 0009 | Journal Wikilinks and Graph | Accepted |
| 0010 | Notification Inbox Model | Accepted |
| 0011 | Spaced Repetition Review System | Accepted |
| 0012 | ZoesJournal Standalone Surface | Accepted |
| 0013 | Task Subtask Hierarchy | Accepted |

**See:** `ARD_compliance.md` (root) for implementation status and gaps

---

## Troubleshooting

### Backend won't start

```bash
# Check Python version (3.10+)
python3 --version

# Reinstall dependencies
cd backend
pip install -e ".[dev]"

# Check database path
echo $DOPAFLOW_DB_PATH
```

### Frontend build fails

```bash
# Clear node_modules
cd frontend
rm -rf node_modules package-lock.json
npm install

# Check TypeScript
npx tsc --noEmit
```

### Desktop app crashes

```bash
# Check backend is running
curl http://localhost:8000/health

# Check Electron version
cd desktop
npm list electron

# Clear build cache
rm -rf dist/
npm run build
```

### Skin not applying

```bash
# Check manifest.json
cat frontend/public/skins/manifest.json

# Check skins.css
grep "data-skin" frontend/src/design-system/skins.css

# Clear browser cache
# Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
```

---

## Getting Help

- **Architecture Questions:** Read `STRUCTURE.md`
- **API Questions:** Read `docs/api-reference.md`
- **Skin Questions:** Read `docs/skineditor.md`
- **ADR Questions:** Read `zoescal/shared/decisions/`
- **Development Roadmap:** Read `next_step.md`
- **Project Context:** Read `CLAUDE.md` (root)

---

*Generated for DopaFlow v2.0.0-beta*
*Last Updated: March 31, 2026*
