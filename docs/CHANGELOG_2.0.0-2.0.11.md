# DopaFlow Changelog

All notable changes, development sessions, and version history for DopaFlow.

---

## Unreleased

### 2026-04-11

**Status:** v2.0.11 release repair — critical bugs, security fixes, dead code deletion, and GitNexus audit sweep

#### Critical functional fixes

- `desktop/main.js` — `backendArgs = ["run_packaged"]` so PyInstaller binary actually runs the backend entry point (was running bare Python, all API features silently broken in packaged builds)
- `desktop/runtime-auth.js` — sets `DOPAFLOW_TRUST_LOCAL_CLIENTS=1` so auth scope checks pass in packaged mode

#### Skin/UX fixes

- Gradient skins now apply on Today surface cards — `--card-gradient` CSS token wired into 6 card components: `MomentumCard`, `HabitsToday`, `FocusQueue`, `BacklogColumn`, `ContextCard`, `TimeBlocks`
- `SkinPicker.tsx` — complete rewrite: single-click instant apply, gradient preview strips, flash confirmation, DK/LT badges, Reset button (was broken: double-click required, no preview, no confirmation)

#### Security fixes (exception leak sanitization)

- `sync_service.py:539-545` — path traversal guard added before file access
- `alarms/router.py`, `player/router.py`, `vault_bridge/router.py`, `nutrition/router.py`, `review/router.py`, `ops/router.py`, `calendar_sharing/service.py` — all `str(exc)` leak sites replaced with `f"{type(exc).__name__}"` safe messages

#### Dead code deleted

- `backend/app/domains/review/anki_router.py` — duplicate APKG router, never registered
- `backend/app/domains/alarms/player_router.py` — duplicate alarm URL router, never registered
- `backend/app/domains/journal/templates_router.py` — duplicate template router, never registered
- `backend/app/domains/journal/transcribe_router.py` — duplicate transcribe router, never registered
- `frontend/src/api/commands.ts` — `previewVoiceCommand` had zero callers

#### Route/navigation fixes

- `appRoutes.tsx` — `open-search` and `search` intents now route to `"search"` surface (were routing to `"tasks"`)
- `goals.ts` — deleted `updateGoal` helper (no callers, no backend PATCH handler)

#### API centralization fixes

- `nutrition/index.tsx`, `SearchBar.tsx`, `TemplatesPicker.tsx`, `WebhookPanel.tsx`, `review.ts` — all hardcoded `http://127.0.0.1:8000/api/v2` now use centralized `API_BASE_URL` from `client.ts`

#### Calendar sharing wiring

- `CalendarSharingSettings.tsx` + `CalendarPeerFeedsSection.tsx` — wired `updatePeerFeed` API: added editing state, `handleEditFeed` handler, edit-mode UI with label/color fields and save/cancel buttons

#### Bootstrap effect race condition

- `App.tsx:105-124` — hashchange handler captured stale `route` from closure when navigating plan↔shutdown overlays; fixed by reading `getRouteFromHash()` fresh instead of relying on captured `route` state

#### Audit findings (documented, no action needed)

- `Tooltip`, `ContextMenu`, `Badge` design-system primitives are unused (zero imports)
- All exported hooks (`useSpeechRecognition`, `useTTS`, `useUpdateBanner`, `useFocusTimer`, `useKeyboardShortcuts`, etc.) confirmed live with active callers

#### Docs cleanup

- `docs/userguide.html` — removed stale agent role rows (Mimo, Nematron, OpenClaw — don't exist)
- `CODEBASE_MAP.md` — removed all non-existent agent directory entries
- `vault_bridge/router.py` — added full 15-route ENDPOINTS comment block
- `nutrition/router.py` — corrected ENDPOINTS comment (wrong paths: `/nutrition/{identifier}` → `/nutrition/log/{entry_id}`, added missing `/log/from-food`)

#### Shared type parity (Task 21)

- `shared/types/index.ts` — added missing fields to match backend schemas:
  - `Task`: added `dependencies[]`, `source_instance_id`
  - `FocusSession`: added `task_title`
  - `JournalEntry`: added `auto_tags`, `created_at`, `updated_at`
  - `Habit`: added `description`, `created_at`, `deleted_at`, `progress`

#### Nutrition log refresh wiring (Task 25)

- `useCommandExecutor.ts` — `"nutrition.log"` refresh callback now dispatches `dopaflow:nutrition-logged` event instead of no-op
- `nutrition/index.tsx` — NutritionView listens for `dopaflow:nutrition-logged` and calls `load()` to refresh; also fires the event after successful log POST

#### Migration-to-repository parity (Task 41)

- No mismatches found — all repository queries use only columns defined in migration schemas
- `Task.dependencies` correctly sourced from `task_dependencies` join table (migration `001b_task_time_log.sql`)
- `HabitRead` computed fields computed at read time, not stored columns
- `JournalEntry.auto_tags` correctly mapped from `auto_tags_json` column

#### Toast accuracy fixes (Task 43)

- `habits/index.tsx` — replaced raw error message exposure with `"Could not create the habit. Check the server is running."`
- `digest/index.tsx` — replaced raw error with actionable guidance
- `onboarding/OnboardingModal.tsx` (3 sites) — added actionable guidance to all three create-failure toasts
- `player/index.tsx` — replaced uninformative "Resolution failed" with `"URL resolution failed. Check the stream is accessible."`

#### Audit findings — Tasks 35, 36, 45 (documented, no code changes needed)

- Task 35: All 19 lazy surface imports resolve correctly — no stale routes, no alias mismatches
- Task 36: Test coverage gaps correspond to intentionally unimplemented features (goals PATCH) or dead code — not critical
- Task 45: All backend ENDPOINTS comment blocks match actual decorators — no stale comments found

#### Audit findings — Tasks 33, 38, 39, 46, 47, 48, 49

- Task 33: RefreshMap complete — all 14 command intents mapped to refreshers; `search` and `nutrition.log` wired
- Task 38: `Tooltip`, `ContextMenu`, `Badge` design-system primitives are unused (zero imports)
- Task 39: All exported hooks have active callers — no stale abstractions
- Task 46: Nutrition legacy `/today`, `/history`, `/recent` kept for backward compat; no stale alternative implementations found
- Task 47: All 31 domain/auxiliary routers confirmed registered in `main.py` — no dead endpoints
- Task 48: Only dead deletion candidates are unused primitives (`Tooltip`, `ContextMenu`, `Badge`)
- Task 49: Mixed `@ds/primitives` vs relative import paths throughout — cosmetic debt, no functional impact

### 2026-04-09

**Status:** shell/desktop refactor notes absorbed into the changelog and obsolete work-folder snapshots started to be retired

### Shell and desktop coordinator cleanup

- Split `desktop/main.js` down to orchestration instead of keeping polling, notifications, routing, and window lifecycle in one file.
- Moved notification/alarm polling into:
  - `desktop/notification-runtime.js`
- Moved window/routing concerns into:
  - `desktop/window-runtime.js`
- Earlier validation on the desktop split passed with `node --check` against the touched desktop files.

### Frontend shell godfile cleanup

- Reduced `frontend/src/shell/TopBar.tsx` to a thin coordinator.
- Split top bar responsibilities into:
  - `frontend/src/shell/TopBarBanners.tsx`
  - `frontend/src/shell/TopBarControls.tsx`
- Reduced `frontend/src/shell/Sidebar.tsx` to a thin coordinator.
- Split sidebar responsibilities into:
  - `frontend/src/shell/SidebarSections.tsx`
  - `frontend/src/shell/SidebarFooter.tsx`
- Verified the frontend shell refactor with:
  - `PATH=/home/henry/vscode/.codex-bin:/home/henry/vscode/.codex-tools/node-v20.20.2-linux-x64/bin:$PATH npm --prefix /home/henry/vscode/build/dopaflow/frontend run typecheck`
  - result: passed

### Documentation cleanup

- Promoted backend/frontend session notes into the changelog so internal workflow docs no longer need competing summary snapshots as a second record of shipped work.
- Kept the live documentation truth set centered on:
  - `CHANGELOG.md`
  - `docs/CHANGELOG_2.0.0-2.0.11.md`
  - `README.md`
  - `docs/internal/ai-workflow/LLM_work_folder/` (internal workflow and prompts)

### 2026-04-07

**Status:** backend hardening sweep with contract-safe logging and narrower fallbacks

### Backend hardening pass

- Gamification Packy notification failures are now logged without preventing XP awarding.
- Focus gamification award failures are now logged without breaking focus completion.
- Journal gamification award failures are now logged without breaking journal entry creation.
- Digest optional analytics reads now only fall back on missing-table cases; unexpected SQLite failures now surface and missing-table fallback emits warnings.
- NLP quick-add fallback parser failures are now logged while intent classification still degrades to `unknown`.
- Health memory-depth fallback now logs missing `journal_entries` instead of silently degrading to `0`.
- Packy answer/whisper handling now logs invalid `recent_mood` payloads instead of silently swallowing malformed lorebook state.
- Player yt-dlp subprocess and API resolution failures now emit warnings with URL context while preserving the existing response contract.

### Focused verification from the backend pass

- `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests/test_player.py backend/tests/test_packy.py -q`
  - `8 passed in 37.23s`
- `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests/test_player.py backend/tests/test_packy.py backend/tests/test_health.py backend/tests/test_nlp.py -q`
  - `70 passed in 38.18s`

**Date:** 2026-04-05
**Status:** Obsidian bridge hardening plus first premium-closure slice, calendar editing pass, and Calendar Maturity Wave 2, plus NLP/Packy trust hardening (Waves 1-6)

### NLP / Packy Trust Hardening

**Wave 1 — Undo is now real:**
- `command_logs` table gains `result_json` column — stores entity IDs needed for undo
- `add_log()` accepts `result` kwarg; serialised as JSON in `result_json`
- `history()` returns deserialised `result` dict for each entry
- `task.create` undo: soft-deletes the created task
- `task.complete` undo: reopens the task via new `uncomplete_task()` in task repo
- `calendar.create` undo: deletes the created event
- Journal, focus, alarm, habit, review, search, nutrition correctly return `unsupported`
- 5 new integration tests: create→undo, complete→undo, nothing-to-undo, unsupported skip, history stores result

**Wave 2 — Preview/execute trust:**
- `canExecute` in VoiceCommandModal now checks `status !== "needs_datetime"` — incomplete calendar commands no longer show "Confirm & Run"
- Preview correctly sets `would_execute=False` for greeting/help/unknown and `status="needs_datetime"` for calendar without time
- 4 new contract tests: incomplete calendar preview/execute, greeting not executable, unknown not executable

**Wave 3 — Intent precision:**
- Fixed `\brain\s*dump\b` regex typo (was `\brain` = word-boundary + "rain") — journal.create "brain dump" now scores correctly
- Removed bare "go" from focus.start `\blet'?s\s+(?:focus|work|get\s+to\s+work)\b` — "let's go to the store" no longer triggers focus
- Bumped `check\s+(?:it\s+)?off` from 0.7 to 0.9 — "check it off" now correctly triggers task.complete instead of habit.checkin
- Bumped `brain\s*dump` from 0.8 to 1.0 — "brain dump" reliably triggers journal.create
- 11 new precision edge-case tests in TestClassifyPrecision

**Wave 4 — Packy response quality:**
- Softened TTS responses: "Journal entry saved.", "Nutrition logged.", "Habit checked in." — no longer bossy or assuming streaks
- Undo TTS: "Undoing your last action." (was "Undoing that.")
- Undo follow-ups: ["What did I do today?"] (was empty)

**Wave 5 — Frontend voice trust:**
- `canExecute` gate prevents "Confirm & Run" for needs_datetime, unknown, greeting, help
- Preview card shows entity chips with icons (priority ⚡, due 📅, duration ⏱, recurrence 🔄)
- Compound results show individual sub-command status
- JarvisOverlay JARVIS-style concentric circle wave animation during TTS (earlier session)

**Wave 6 — Tests and verification:**
- 89 tests passing (up from 69): 54 NLP, 26 commands, 9 voice commands
- Frontend type-checks clean

### Review Premium Wave

- **Keyboard shortcuts in card reviewer:** Space or F flips the card; 1/2/3/4 rate Again/Hard/Good/Easy when flipped. Shortcut hints display on the rating buttons and Show Answer button. Input fields are excluded from shortcut scope so typing in deck forms isn't intercepted.
- **Session completion screen:** When the due queue empties after reviewing cards, a "Session complete" screen replaces the bare empty state. Shows cards reviewed this session, whether more cards are due in other decks, and a reminder that intervals were updated. (The "No cards due" fallback still appears for users who open the surface with nothing pending.)
- **Card editor:** New `PATCH /review/cards/{card_id}` backend endpoint to update a card's front and back. Frontend exposes an Edit button on both the active card face and each queue list item. Opens a modal pre-filled with the current text; saves on confirmation and refreshes the card list.
- **Regression coverage:** 5 new backend tests (PATCH front/back, validation, 404, SM-2 easy vs. good interval comparison, lapse reset). 6 new Playwright tests (card render, Show Answer flow, Space flip, empty deck, edit modal opens, surface loads clean).

### Calendar Maturity Wave 2

- **Drag-to-reschedule in Day view:** Local editable events can now be dragged vertically to reschedule. Drag activates on first mouse movement (not bare click), so click-to-open still works cleanly. Duration is preserved. Success/error toast after commit. Read-only mirrored events are not draggable.
- **Resize local events in Day view:** A drag handle appears at the bottom of local events. Dragging it adjusts the end time with 15-minute snapping and a 15-minute minimum duration. Commits on mouse release with success/error toast.
- **Event details modal polish:** Source metadata panel now shows category chip, recurrence label, and time range at a glance. Lock icon on read-only mirrored events. Delete confirmation has a Cancel escape. Saving/deleting state labels are clearer.
- **Source color clarity:** Lock icon (🔒) now appears on read-only event cards in Day and Week views. Source dot is always visible. Title attribute includes read-only status.
- **Week view density cap:** Week cells now cap at 4 visible events with a "+ N more" overflow button. Overflow button opens the next event in the modal.
- **Month view +N more button:** The overflow indicator is now a clickable button that opens the next hidden event, not just a text label.
- **Calendar quick-create validation:** Added NaN guard on date/time inputs, minimum-duration check (1 minute), and clearer success toast with event title. Recurrence labels updated to plain language ("Every day", "Every week", etc.).
- **Explicit loading states:** DayView shows a "…" indicator on events while reschedule or resize is in flight. Modal delete button shows "Deleting…" during async delete.
- **Regression coverage:** 4 new backend tests for move endpoint and PATCH date changes. 6 new Playwright tests covering: click-to-open modal, read-only event guard, save/delete buttons, week view event render, month view overflow, surface load without errors.

### Skin editor polish

- Enhanced SkinPicker with live preview workflow:
  - single-click to preview a theme before applying
  - double-click or "Apply" button to confirm the selection
  - clear visual indicator showing "Currently active" vs "Previewing (not applied yet)"
  - "Reset to default" button for quick recovery
  - export current theme as JSON for backup/sharing
  - import custom theme JSON files
  - error handling for invalid imported configs
  - empty state handling when no skins are available
- Added Playwright smoke tests for skin editor flow:
  - verify themes display correctly
  - test preview and apply workflow
  - test reset to default
  - verify export/import buttons exist

### Premium closure slice

- Added a real integrations overview in Settings:
  - one panel for Gmail, GitHub, webhooks, calendar sharing, Turso, and Obsidian
  - normalized health labels (`Connected`, `Needs attention`, `Disabled`, `Error`, `Local-only`)
  - direct jump buttons into the detailed settings sections
- Restored the nutrition starter library as protected preset foods:
  - coffee, tea, water, milk, sugar, bread slice, butter, cheese slice, ham slice, and a basic sandwich
  - presets now self-heal into existing databases instead of depending on a fresh migration run
  - nutrition surface now exposes the starter library with one-tap logging
- Surfaced gamification in daily use instead of keeping it buried on its own page:
  - top bar now shows progress to next level
  - successful task completion and focus completion now trigger a gamification refresh path
  - XP and level-up feedback now shows through global toasts
- Added coverage for the slice:
  - backend nutrition preset tests
  - backend integrations status test
  - frontend smoke for integrations overview, shell XP visibility, and nutrition starter presets

### Calendar editing maturity

- Calendar is no longer a thin display-only surface:
  - click local or mirrored events from week/day/month views to open details
  - local events can now be edited in-place for title, description, date, start/end time, category, all-day state, and recurrence
  - local events can be deleted from the same modal instead of forcing a separate flow
  - quick-add calendar blocks now support category and recurrence from the UI
- Added frontend coverage for the new editing path:
  - Playwright smoke now opens a calendar event, edits it, saves it, and verifies the success path

### Obsidian bridge

- Added a real local-first Obsidian vault bridge:
  - vault config/status/index/conflicts/rollback
  - journal push/pull against Markdown daily notes
  - task collection push/pull against Obsidian-compatible checkbox files
  - daily task section push into existing daily notes using bounded markers
  - task import preview/import from DopaFlow-owned and plain markdown task files in the configured task folder
- Added the backend domain and migration:
  - `backend/app/domains/vault_bridge/`
  - `backend/migrations/028_vault_bridge.sql`
- Added the frontend settings UI and API wiring:
  - `frontend/src/api/vault.ts`
  - `frontend/src/surfaces/settings/VaultSettings.tsx`
  - `frontend/src/surfaces/settings/index.tsx`
  - `shared/types/index.ts`
- Hardened the task bridge after integration review:
  - task push now exports completed tasks instead of dropping them
  - task push now marks conflicts instead of blindly overwriting drifted indexed task files
  - task routes now use task scopes instead of journal scopes
  - import idempotency now uses a stable source locator instead of naive repeated create calls
  - vault task ID write-back now surfaces failure instead of claiming false success
  - duplicate task-line targeting now uses absolute file line numbers
  - conflict rows now support previewing current vault content against the last indexed DopaFlow snapshot
  - conflict preview now includes a compact unified diff summary instead of only raw side-by-side blobs

### Obsidian verification

- Backend vault bridge suite now covers:
  - frontmatter
  - file naming
  - section manager behavior
  - task writer/reader round-trip
  - task import flow
  - sync-service task/journal/daily-note paths
- Current verified counts:
  - backend vault bridge tests: `117 passed`
  - frontend Playwright suite: `35 passed`
- Installed local release refreshed and verified at:
  - `http://127.0.0.1:8000`

### E2E hardening

- Replaced more low-signal route/surface checks with behavior assertions in:
  - `frontend/tests/e2e/daily_loop.spec.ts`
  - `frontend/tests/e2e/goals_flow.spec.ts`
  - `frontend/tests/e2e/route_startup.spec.ts`
- Added coverage for:
  - Today -> Focus handoff with prefilled task target
  - Goals empty state
  - Command palette navigation (`Ctrl/Cmd+K`)
  - stronger route startup expectations for Today, Settings, and core routes

### UI polish

- Continued the hierarchy pass on the Habits surface:
  - added a runway summary header
  - added compact live stats for tracked/done/best streak
  - reframed the create form as a clearer capture panel
- Added shell-density controls alongside skins:
  - `compact`, `comfortable`, and `expanded` layout modes now live in Settings
  - layout is persisted separately from skin/theme choice
- Tightened shell/day-state polish:
  - Today now shows an explicit day-state pill (`Planned`, `Needs plan`, `Future`, `Review`)
  - Notification inbox now degrades gracefully when titles, levels, or body fields are partial/missing
- Finished the shell/digest trust pass:
  - top bar inbox affordance now reads like a real product control instead of an abbreviation
  - notification inbox now groups `Needs attention` vs `Recently cleared`
  - digest now explains momentum in plain language, includes loading/error states, and adds a "What this period says" interpretation layer instead of only raw counters

### Tooling and docs

- Consolidated internal workflow routing into the changelog instead of keeping one-off prompt files around.
- Added a durable agent split for the next premium push:
  - Claude Sonnet + Haiku lane: premium closure implementation owner for large coherent waves
  - Minimax lane: contained polish/test/regression closer for small sign-off slices
  - Codex lane: repo-wide premium-gap closer focused on turning credible surfaces into premium ones without drifting into more domains
- Updated `docs/userguide.html` to remove stale surface counts, stale shortcut docs, stale skin count, and machine-specific local paths.
- Hardened frontend API targeting for local release/runtime use:
  - default API base now follows `window.location.origin` instead of assuming `127.0.0.1:8000`
  - network fetch failures now raise a visible toast instead of only surfacing as opaque uncaught promise errors
- Replaced stale markdown snapshots with a live roadmap in `next_steps.md`.
- Added a real generated `.apkg` backend regression test so imported review cards are verified to enter the normal SM-2 scheduling path.
- Updated the live roadmap/README to call out the lost nutrition starter-library regression from the older release as explicit future work.

### Focus runtime

- Fixed the active-focus session mismatch where backend sessions were stored as `"active"` but the frontend only treated `"running"` / `"paused"` as live timer states.
- Normalized legacy `"active"` focus rows on the frontend so old release data does not strand a session in history without a countdown.
- Strengthened focus E2E so it asserts the active timer/countdown path after session start.

### Verification

- Current verification entrypoint:
  - `bash docs/internal/ai-workflow/LLM_work_folder/run_frontend_verification.sh`
- Current frontend verification result:
  - `35 passed`

## Version 2.0.7

**Release Date:** 2026-04-04
**Status:** Installed local release verified in `/home/henry/release/DopaFlow-2.0.7-web`

### Highlights

- Fixed the local release path so `/home/henry/release/run-dopaflow-2.0.7.sh` serves the working app bundle.
- Rebuilt and restaged the frontend bundle into the installed release.
- Cleared the remaining route-level frontend regressions and verified the app with the full Playwright suite.

### Fixes

- Release wrapper/API serving
  - fixed frontend catch-all behavior in `serve_release.py` so API requests stop receiving `index.html`
- Onboarding
  - fixed final-step lockup and modal trap
- Shutdown flow
  - fixed app-level shutdown open event handling
  - fixed plan/shutdown modal conflicts
  - fixed defer-step deadlock
  - removed duplicate copy that caused ambiguous route-level checks
- Surface crash hardening
  - `useGamification.ts` now tolerates partial/empty gamification payloads
  - `useFocus.ts` now tolerates non-array session payloads
  - `useInsights.ts` now tolerates partial digest/correlation payloads
  - `overview/index.tsx` now validates `/digest/today` payload shape before rendering `DigestCard`
- Tasks/goals/runtime
  - quick-add task creation now actually creates a task
  - added the missing goals backend domain and migration
  - fixed Packy lorebook ID collisions
- Tooling
  - `frontend/playwright.config.ts` now uses the persistent Node path and bundled runtime libs instead of stale `/tmp` assumptions

### Verification

- Frontend build passed
- Full Playwright suite passed: `17 passed`
- Installed release smoke after restart passed for:
  - `today`
  - `tasks`
  - `focus`
  - `goals`
  - `overview`
  - `commands`
  - `settings`

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

#### Implementation Notes

The repo-grounded restart points:

- `CHANGELOG.md` - shipped changes plus active hardening notes
- `docs/internal/ai-workflow/LLM_work_folder/` - internal workflow prompts and agent rules

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

- Skeleton loaders now cover the core surfaces instead of blank loading gaps:
  - `today` uses a layout-matched page skeleton
  - `overview` uses runway + stats + card skeletons
  - `goals` uses form + goal-card skeletons
  - task, habit, review, and journal list panels keep skeleton list states
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
