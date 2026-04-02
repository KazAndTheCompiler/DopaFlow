# DopaFlow Changelog

All notable changes, development sessions, and version history for DopaFlow.

---

## Version 2.0.0-beta (Current Development)

**Release Date:** In Development
**Status:** Active development branch at root level

### Overview

DopaFlow v2 is a unified productivity app for ADHD brains. It combines the ZoesTM tasks, habits, focus, review, and alarms workflows with ZoesCal calendar planning and ZoesJournal journaling into one multi-surface app backed by FastAPI, SQLite, React 18, Vite, TypeScript strict mode, and an Electron desktop shell.

### Architecture Changes from v1

**v1.2.7 Architecture:**
- Router count: 23 files
- Total lines: 5,234 LOC in routers alone
- Average router size: ~227 LOC per file
- Routing pattern: Flat, non-hierarchical; one router = one domain
- Organization: Minimal separation of concerns; service logic mixed with route handlers
- Database interaction: Direct SQL in routers via `conn()` context manager

**v2 Architecture:**
- Domain count: 17 domains (+ projects, motivation, boards, player, commands, digest, meta, ops)
- Router count: 21 files (including specialized routers)
- Total lines: ~1,689 LOC in routers
- Average router size: ~81 LOC per file (3x smaller)
- Routing pattern: Hierarchical; one domain = one folder with service + repo + schemas
- Organization: Clear separation (router, service, repository, schemas)
- Database interaction: Abstracted through repository layer using `get_db()` and `tx()`

### What v2 Does Better

1. **Clear architectural separation of concerns**: Service/repo/schema pattern is significantly more testable than v1's inline logic
2. **Faster router implementations**: Routers are thin HTTP adapters (~80 LOC avg) instead of fat bundles (~230 LOC avg)
3. **Reduced code duplication**: Shared services (`quick_add.py`, `player.py`) are properly extracted and injected via dependencies
4. **Dependency injection pattern**: Use of `Depends()` for service instantiation makes testing easier and dependencies explicit
5. **Database abstraction**: Repository pattern shields routers from SQL; easier to refactor queries or swap storage backend
6. **Focused domain folders**: Each domain is self-contained; easier to understand scope at a glance

### Feature Coverage vs v1.2.7

| Feature/Domain | v1 | v2 | Status |
|---|---|---|---|
| Tasks (CRUD, templates, subtasks, time log) | ✓ | ✓ | ✓ present |
| Task board views (Kanban, Eisenhower) | ✓ | ✓ | ✓ present |
| Quick-add natural language parsing | ✓ | ✓ | ✓ present |
| Habits (checkin, logs, freeze/unfreeze) | ✓ | ✓ | ✓ present |
| Habit insights (weekly, goals, correlations) | ✓ | ✓ | ✓ present |
| Focus/Pomodoro sessions | ✓ | ✓ | ✓ present |
| Focus session history and stats | ✓ | ✓ | ✓ present |
| Journal entries (CRUD, wikilinks, graph) | ✓ | ✓ | ✓ present |
| Journal entry backup to markdown | ✓ | ✓ | ✓ present |
| Journal templates | ✓ | ✓ | ✓ present |
| Journal transcription (audio-to-text) | ✓ | ✓ | ✓ present |
| Calendar events (CRUD, Google sync) | ✓ | ✓ | ✓ present |
| Calendar OAuth and conflict resolution | ✓ | ✓ | ✓ present |
| Alarms (schedule, trigger, TTS, YouTube queue) | ✓ | ✓ | ✓ present |
| Notifications (create, read, archive) | ✓ | ✓ | ✓ present |
| Review/Spaced repetition (SM-2, decks) | ✓ | ✓ | ✓ present |
| Nutrition logging | ✓ | ✓ | ✓ present |
| Insights (momentum, weekly digest) | ✓ | ✓ | ✓ present |
| Cross-domain search | ✓ | ✓ | ✓ present |
| Packy memory support | ✓ | ✓ | ✓ present |
| Gamification (badges, XP, levels) | ✓ | ✓ | ✓ present |
| Integrations (Gmail, webhooks) | ✓ | ✓ | ✓ present |
| Focus time analytics | ✓ | ✓ | ✓ present |
| Todoist CSV import | ✓ | ✓ | ✓ present |
| Digest endpoints | ✓ | ✓ | ✓ present |
| Health/wellness monitoring | ✓ | ✗ | ✗ missing |
| Goggins motivational trigger | ✓ | ~ | ~ partial |
| Commands/macros (batch operations) | ✓ | ✓ | ✓ present |
| Authz scopes (per-feature permissions) | ✓ | ✓ | ✓ present |
| APKG full spec compliance | ✓ | ~ | ~ partial |
| Rate limiting per endpoint | ✓ | ✓ | ✓ present |
| Upload validation (file type/size) | ✓ | ~ | ~ limited |

### Known Gaps from v1

**Current notable gaps vs the older surface:**
- Digest email delivery: v2 has digest endpoints but not the older scheduled email flow
- Health/wellness module: v1 routers/health.py monitors health metrics; v2 has only basic health checks
- Motivation: v2 has quotes and trigger flow, but not the fuller older challenge system

**Less critical but notable:**
- Upload validation: v1 has robust file-type, size, and content validation; v2 has basic validation only
- Comprehensive APKG support: v1's anki_apkg.py supports full Anki deck export; v2 exports only zip+csv
- Scheduled backups: v1 journal router has async task for nightly exports; v2 only exposes manual trigger endpoint

---

## Development Sessions

### Session 2 — 2026-03-28 (Afternoon)

**Theme:** UI Polish and Competitive Gap Analysis

#### UI Polish Completed

| Component | Changes |
|-----------|---------|
| **Sidebar toggle** | Bare `>/<` → styled `›/‹` icon button with hover color; collapsed state shows momentum score pill |
| **Sidebar footer stats** | Plain text → 5-dot habit pips (filled accent / unfilled border), 🔥 streak count, momentum pill |
| **TopBar timer** | "No timer" removed — hidden when nothing running; shown as accent pill `◴ 25m in_progress` when active |
| **TopBar inbox** | Plain "Inbox (3)" → 🔔 icon with red badge overlay |
| **TopBar focus mode** | "Focus On/Off" → `◉ Focus` / `○ Focus` with opacity |
| **TodayView nav buttons** | Bare buttons → styled with border, Today highlighted in accent when on current day |
| **TaskEditModal Packy hint** | Auto-fetches Packy tip on task open; renders as tinted accent box above the form |

#### Prompt Pack Documentation Added

Added prompt pack documentation for model-specific task routing (consolidated to CHANGELOG.md, source files removed):

| Model | Role |
|-------|------|
| Claude Sonnet | Implementation owner - product-grade frontend/backend work |
| Claude Haiku | Narrow implementation closer - contained fixes and cleanup |
| Minimax | Test builder, regression guard, base-health maintainer |
| Qwen | Documentation owner, repo-state maintainer |

These prompt packs define clear division of labor across helper models used in the development workflow.

#### Codex Documentation

The project maintains running implementation notes in `codex.md` documenting:

- **Calendar Sharing Status**: Full trust pass implementation including peer feeds, share tokens with expiry, mirrored events, feed health status UI
- **Daily Loop Implementation**: Today, Overview, Focus, and Shutdown surfaces with runway guidance, momentum gauge, 3-step evening ritual
- **Backend Hardening**: Remote API authz with signed bearer tokens, scope-protected routers
- **Verification Commands**: Test and build commands verified working

Key files documented:
- `backend/app/domains/calendar_sharing/` - peer sync, share tokens
- `frontend/src/surfaces/today/`, `overview/`, `focus/`, `shutdown/` - daily loop surfaces
- `backend/app/tools/promptpack.py` - CLI for audits, API sync, migrations

See `codex.md` for complete restart points and next sensible work.

#### Features Delegated and Completed

| Feature | Details |
|---------|---------|
| **Evening journal export** | `POST /api/v2/journal/export-today` → `~/.local/share/DopaFlow/journal-backup/YYYY-MM-DD.md`; "Export today" button in journal + silent auto-export on navigate-away |
| **Anki import e2e** | Fixed conflicting duplicate endpoints; added apkg magic bytes validation; fixed DeckList to use API layer with deck selector; 124 tests pass |
| **Alarm Service Worker** | `public/alarm-sw.js` polls every 30s, fires `showNotification()` when backgrounded; `useAlarms.ts` registers SW, requests permission, TTS only when tab visible |

#### Competitive Gap Analysis + Fixes

**Security fixes:**
| Fix | File | Details |
|-----|------|---------|
| SQL injection | `review/repository.py:559` | Added `VALID_CARD_RATING_FIELDS` whitelist before f-string interpolation |
| Query param bounds | `tasks/router.py` | `limit: int = Query(default=100, ge=0, le=500)`, `offset: int = Query(default=0, ge=0)` |
| Rate-limit feedback | `api/client.ts` | 429 → fires toast "Too many requests"; 5xx → fires toast "Server error" |

**Feature strength:**
| Feature | Details |
|---------|---------|
| **Daily shutdown ritual** | `surfaces/shutdown/ShutdownModal.tsx` — 3-step modal: Win strip, Defer (Tomorrow/This week/Drop), Tomorrow preview + emoji mood; wired into App.tsx as 🌙 nav item |
| **Habit progress ring** | 36px SVG ring on HabitCard showing `completion_pct`; green ≥100%, accent 50-99%, warn <50% |
| **Bulk task operations** | Checkbox on TaskRow (hover/selected state); floating action bar "X selected · Complete all · Delete all" |
| **Keyboard shortcuts** | `useKeyboardShortcuts` hook: Ctrl+T → tasks+focus, Ctrl+Shift+F → focus, Ctrl+J → journal, Ctrl+H → habits, Ctrl+Shift+P → plan modal, Esc → close-modal event |
| **NL parse preview** | TaskCreateBar debounces 400ms → calls quick-add dry-run → shows `📅 tomorrow`, `P1`, `# tag` chips below input before committing |

**UI flow fixes:**
| Fix | Details |
|-----|---------|
| **Toast system** | `design-system/primitives/Toast.tsx` — slide-in notifications bottom-right, auto-dismiss 3.5s, types: success/error/warn/info |
| **Optimistic updates** | `useTasks`: complete/remove/update all update local state immediately, rollback on API error |
| **Error states** | `useTasks` and `useHabits` both have `error: string | null` state + catch blocks; failed loads show toast |
| **Toasts on mutations** | `useHabits.create` → "Habit created.", checkIn → "Habit checked in! 🔥"; task bulk ops show counts |

#### Remaining Gaps (Carried Forward)

- No skeleton loaders (surfaces still show blank while loading)
- No onboarding / first-run flow
- No focus session end ceremony (completion modal / break timer prompt)
- CORS dev origins should be stripped at prod build time
- Database migration rollback safety
- Smart sort (sort_by param) on task list endpoint
- Recurring task materialization needs daily background trigger
- Review: no deck create button in DeckList, no study stats dashboard
- Drag-to-reschedule in TimeBlocks not implemented
- Mobile swipe-to-complete on TaskRow

---

## Version 1.2.7 (Legacy)

**Status:** Maintenance mode
**Location:** `apps/` directory

### Features Complete in v1

- All 20+ backend domains
- 44 clean migrations (apps + v2)
- ZoesCal sync + conflict tracking
- All 17 nav surfaces routed
- Tasks: swipe, timer, bulk ops, deps, kanban
- Journal: preview, wikilinks, voice
- Review: create/rename/delete/stats
- Focus: task picker, custom duration, ceremony
- Habits: freeze/unfreeze, rings
- 16 skins, toast system, mobile layout
- Plan my day, shutdown, onboarding modals
- PWA manifest, command palette

---

## Database Migrations (v2)

### Migration History

| # | File | Description |
|---|------|-------------|
| 001 | `001_init.sql` | Core tables (tasks, habits, focus, journal) |
| 001b | `001b_task_time_log.sql` | Task time logging |
| 002 | `002_habits.sql` | Habit tracking schema |
| 003 | `003_focus.sql` | Focus sessions and active state |
| 004 | `004_review.sql` | Spaced repetition decks and cards |
| 005 | `005_journal.sql` | Journal entries and wikilinks |
| 006 | `006_calendar.sql` | Calendar events and sync state |
| 007 | `007_alarms.sql` | Alarm scheduling and metadata |
| 008 | `008_notifications.sql` | Notification center |
| 009 | `009_nutrition.sql` | Food logging and daily totals |
| 010 | `010_integrations.sql` | OAuth tokens and webhook outbox |
| 011 | `011_packy_lorebook.sql` | Packy context storage |
| 012 | `012_indexes.sql` | Performance indexes |
| 013 | `013_oauth_tokens.sql` | Google OAuth token storage |
| 014 | `014_gamification.sql` | Badges, XP, and levels |
| 015 | `015_alarms_audio.sql` | Alarm audio queue |
| 016 | `016_journal_templates.sql` | Journal entry templates |
| 017 | `017_commands.sql` | Saved command macros |
| 018 | `018_ops_metadata.sql` | Key-value ops metadata store |
| 019 | `019_journal_versions.sql` | Journal entry version history |
| 020 | `020_review_sessions.sql` | Review session log enhancements |
| 021 | `021_nutrition_foods.sql` | Nutrition food library |
| 022 | `022_projects.sql` | Projects (task grouping) |
| 023 | `023_calendar_sharing.sql` | Calendar share tokens and peer feeds |
| 024 | `024_auth_scope_tokens.sql` | Registry-backed remote scope tokens |

**Migration Policy:**
- Files are named `NNN_description.sql` (zero-padded to 3 digits)
- Numbers must be contiguous. If a migration number is retired, replace it with a placeholder
- All DDL uses `IF NOT EXISTS` guards
- Write access must go through `tx()` to ensure WAL journaling

---

## Skin System Evolution

### v1 Skins
- 9 named skins
- Flat solid color tokens
- Default: `warm-analog`

### v2 Skins
- 19 total skins (10 additional)
- 3 gradient-enabled skins (`forest-gradient`, `ocean-gradient`, `amber-night`)
- Advanced gradient token system:
  - `--bg-gradient` — Main app background (175° angle typical)
  - `--sidebar-gradient` — Sidebar navigation (180° vertical)
  - `--card-gradient` — Cards and panels (155-160° diagonal)
  - `--surface-gradient` — Elevated surfaces (145° subtle lift)
- Default: `ink-and-stone`
- Skin Maker tool for custom skin creation

---

## Packy Evolution

### v1: Packy AI Assistant
- Marketed as "AI assistant"
- Ask mode for contextual suggestions
- Whisper for passive motivational nudges
- Lorebook for persistent context storage

### v2: Packy Memory Support (Rebranded)
- Rebranded as "Contextual memory and guidance system"
- Emphasizes memory-powered insights over AI
- Same endpoints: `/packy/ask`, `/packy/whisper`, `/packy/lorebook`, `/packy/momentum`
- Lorebook designed for CNN-style contextual inputs rather than assistant persona

---

## Upcoming Work

### Priority 1: Surface Hidden Features
- Wire gamification to nav
- Add sort_by selector to TaskFilterBar
- Add task recurrence_rule input to TaskEditModal
- ZoesCal conflict resolution UI
- ExportPanel wiring verification

### Priority 2: Gradient Skin System
- Add gradient CSS variables to token system
- Evolve skinmaker to support gradient color stops
- Add 3 new gradient skins

### Priority 3: Intelligence Surfacing
- Build InsightsView surface
- Promote Packy whisper to OverviewGrid first-class slot

### Priority 4: Documentation
- Update docs/index.html to v2
- Write architecture document
- Write API reference for v2 backend

### Priority 5: Electron Pre-release Gate (ADR-0008)
- In-app update banner
- Native notifications for alarms
- Global keyboard shortcut
- Security audit
- Platform-specific installers

---

## Compliance Trend

| Date | ADRs Implemented | Partial | Not Started |
|------|------------------|---------|-------------|
| 2026-03-17 | 8 | 5 | 0 |
| 2026-03-30 | 11 | 2 | 0 |

**Progress:** +3 ADRs fully implemented since last audit

---

*Last Updated: March 31, 2026*
