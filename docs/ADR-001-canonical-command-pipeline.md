# ADR-001: Canonical Command Pipeline

**Date:** 2026-04-11
**Status:** Accepted
**Deciders:** DopaFlow engineering

---

## Context

DopaFlow supports multiple command entry points and voice paths. Over time the repo accumulated overlapping surfaces — `commands/execute`, `commands/parse`, `commands/preview`, `commands/voice-preview`, `packy/voice-command`, and `packy/ask` — with unclear authority. This ADR establishes the single authoritative pipeline.

---

## Decision

### Primary Text Command Pipeline

```
Frontend command bar → POST /commands/execute → CommandService.execute()
                                                        ↓
                                                 intent-specific handler
                                                        ↓
                                                 db write / side effects
                                                        ↓
                                                 refresh map (task/journal/calendar/etc.)
                                                        ↓
                                                 Packy.refresh() (momentum + whisper)
```

- **Authoritative endpoint:** `POST /api/v2/commands/execute`
- **Intent vocabulary:** 14 intents — `task.create|complete|list`, `journal.create`, `calendar.create`, `focus.start`, `alarm.create`, `habit.checkin|list`, `review.start`, `search`, `nutrition.log`, `greeting`, `help`, `undo`
- **Source field:** `source="text"` (vs `"voice"` for spoken commands)
- **Refresh:** Each intent maps to a surface refresher in `RefreshMap`; Packy shell is also refreshed
- **Navigation:** `intentRoutes` maps intent → `AppRoute` for automatic navigation

### Primary Voice Command Pipeline

```
VoiceCommandModal → sendVoiceCommand() → POST /packy/voice-command → PackyService.voice_command()
                                                                        ↓
                                                            nlp.classify() + CommandService.preview()
                                                                        ↓
                                                        PackyVoiceResponse (preview or executed)
```

- **Authoritative endpoint:** `POST /api/v2/packy/voice-command`
- **Two modes:**
  - `auto_execute=false` → preview only (frontend shows "Execute" button)
  - `auto_execute=true` → server-side execute, return result
- **Context threading:** `VoiceCommandModal` passes `{ route: currentRoute }` context on both preview and execute
- **NLP context note:** `nlp.classify()` currently ignores context (P02 finding). Route context is used only by Packy's `ask()` for nudge generation.

### Secondary/Debug Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /commands/list` | Enumerate available commands | Kept — supports command debugging UI |
| `POST /commands/parse` | Parse without executing | Kept — command debugging UI |
| `POST /commands/preview` | Preview without executing | Kept — debugging UI |
| `POST /commands/voice-preview` | Legacy voice preview | Kept — secondary/debugging |
| `POST /packy/ask` | Legacy Packy ask | Kept — used by top-bar command executor fallback |
| `POST /packy/voice-command-audio` | Audio upload STT | Kept (unwired) — browser STT is primary |

### Packy / Ask Fallback Pipeline

```
Top-bar unknown intent → packy.ask() → PackyService.ask()
                                            ↓
                               nlp.classify() → PackyAnswer
                                            ↓
                               context_nudge (if route known + intent unknown)
                                            ↓
                               actionRoutes[action] → navigate
```

- Used when command execution returns `status in {greeting, help, unknown, ok}`
- Passes `{ route: currentRoute }` context for route-aware nudges
- Route nudge complements: tasks↔habits, habits↔focus, focus↔review, review↔journal, journal↔today, calendar↔tasks, nutrition↔today

---

## Intent / Action Vocabulary

Single source of truth: `backend/app/core/vocabulary.py`

| Intent | Action |
|--------|--------|
| `task.create` | `open-task-create` |
| `task.complete` | `open-tasks` |
| `task.list` | `open-tasks` |
| `journal.create` | `open-journal` |
| `calendar.create` | `open-calendar` |
| `focus.start` | `start-focus` |
| `alarm.create` | `open-alarms` |
| `habit.checkin` | `open-habits` |
| `habit.list` | `open-habits` |
| `review.start` | `open-review` |
| `search` | `open-search` |
| `nutrition.log` | `open-nutrition` |
| `greeting` / `help` / `unknown` | `open-command-bar` |

Frontend `RouteIntentAction` type mirrors this in `appRoutes.tsx`.

---

## Known Gaps

1. **NLP context ignored (P02):** `nlp.classify()` accepts but does not use `context`. Route-aware disambiguation is a future expansion.
2. **Search query handoff:** Search commands navigate to the search surface but do not carry the extracted query into surface state.
3. **`preview`/`execution_result` typing:** These remain `dict[str, object]`. Would require significant commands-domain schema work to type per intent.
4. **`_enrich_response` removed:** Was inert scaffolding. Deleted in this pass.
5. **Intent/action registries:** Hand-copied string literals in multiple files. `vocabulary.py` is the canonical source, but `nlp.py` and `appRoutes.tsx` maintain independent copies.

---

## Consequences

- All new command/voice features must wire through `commands/execute` (text) or `packy/voice-command` (voice)
- Debug/preview endpoints are explicitly secondary — they must not diverge from the authoritative pipeline behavior
- Route context must be threaded through all Packy entry points for nudge fidelity
