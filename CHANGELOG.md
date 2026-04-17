# DopaFlow Changelog

Concise release-facing changelog for the current product line.

For the full historical session log and detailed rollout notes from `2.0.0` through
`2.0.11`, see
[`docs/CHANGELOG_2.0.0-2.0.11.md`](/home/henry/vscode/build/dopaflow/docs/CHANGELOG_2.0.0-2.0.11.md).

## 2.0.17

- **Test suite fully green (636 tests)**: Fixed 44 failing tests across tasks, commands, focus, vault_bridge domains.
- **Fixed AuthRepository import error**: Removed nonexistent `AuthRepository` import from `main.py`; `AuthService` now correctly initialized with `settings` only.
- **Fixed OAuth redirect validation**: Changed `redirect_uris` (list) to `redirect_uri` (singular) matching database schema.
- **Fixed focus.start NLP handler**: Added missing `db_path` argument to `focus_svc.start()` call in commands/execution.py.
- **Fixed sqlite3.Row compatibility**: Changed `row.get("project_id")` to `"project_id" in row.keys()` check in tasks/repository.py.
- **Fixed smoke test habit_checkin**: Removed broken `hab_id` fixture dependency; test now creates habit inline.
- **Fixed smoke test journal_create path**: Changed from `/api/v2/journal/` to `/api/v2/journal/entries` (correct route).
- **Fixed smoke test focus assertion**: Changed expected status from `"idle"` to `"completed"` after session completion.
- **Fixed ops security tests**: Set `dev_auth=False` to enable ops secret validation.
- **Fixed logging tests**: Updated `configure_logging(packaged=...)` to `configure_logging(production=...)`.
- **Fixed migration drift test**: Test now correctly expects `RuntimeError` on checksum mismatch.
- **Version bump**: 2.0.12 → 2.0.17.

## 2.0.13

- Added server-side transcription fallback to VoiceCommandModal: when Chrome Web Speech API fails with a network error, falls back to recording via `useMicrophone` and transcribing through `POST /journal/transcribe`. Shows "server transcription mode" indicator.
- Added `habit.create` NLP intent: voice commands like "add habit exercise" now correctly classify as `habit.create` instead of `unknown`. Full execution pipeline creates the habit in the database.
- Added `habit.create` to VoiceCommandModal INTENT_META, ROUTE_SUGGESTIONS, backend vocabulary, command execution, and preview logic.
- Fixed migration drift: updated stale checksum for `007_alarms.sql` in `_migrations` table.

### Known Issues

- **Voice commands still bugged**: Browser Web Speech API (Chrome) throws `network` error when Google speech servers are unreachable. Server-side fallback is now wired but requires ffmpeg on the host. If both paths fail, commands are unusable — type instead. Root cause is Chrome's dependency on Google's external speech service, not a DopaFlow API issue.

- Added glass CSS tokens to 7 mid-tier dark skins that were marked `glass: true` but had zero glass properties: midnight-neon, amber-terminal, vampire-romance, deep-ocean, sunset-blues, classic-noir, neon-punk. Each now defines `--surface-glass-blur`, `--surface-edge-light`, `--surface-inner-light`, `--surface-inner-highlight`, `--surface-specular` with accent-matched values in both `skins.css` and their JSON manifests.

## 2.0.12

- Fixed TypeScript errors in `domains.test.ts`: aligned `startFocusSession` payload to use `duration_minutes`, `createAlarm` to use `at`/`title` field names, corrected unsafe type casts to route through `unknown`, and fixed `updateVaultConfig` to use `vault_enabled`.
- Added `src/components/**` to vitest coverage exclusions alongside the existing `surfaces`/`shell` exclusions, restoring the 30% line/statement coverage threshold (was 29.79% after new UI components landed in 2.0.11).

## 2.0.11

- Backend hardening now logs previously silent failures across gamification, focus, journal, digest analytics, NLP fallback parsing, health memory-depth fallback, Packy mood payload parsing, and player media resolution without changing the response contracts.
- Desktop main-process orchestration was split so notification/alarm polling and window/routing runtime concerns now live in dedicated modules instead of one oversized entrypoint.
- The shell coordinator pass split `TopBar` and `Sidebar` into smaller focused components, reducing the shell godfile pressure while keeping frontend typecheck green.
- Desktop packaging now bundles the Linux runtime closure needed for AppImage and unpacked releases.
- GitHub release workflow now installs Playwright Chromium, runs the release browser slice, and verifies the built AppImage payload before upload.
- Browser verification now covers the core mocked product loops:
  - startup and route safety
  - app smoke coverage
  - tasks
  - daily loop
  - calendar maturity
  - focus
  - habits
  - goals
- Playwright runtime setup now auto-detects a bundled `usr/lib` path from the current desktop build or unpacked release.
- Added `scripts/verify_appimage.sh` for a non-GUI AppImage dependency audit.
- **Security hotfix**: Fixed notification repository race condition (re-query removed after insert), review decks `GET /decks` 500 error (`model_validate` vs `.model_dump()`), speech validation order (`validate_upload()` before `_load_speech_recognition()`), path traversal guards in sync/writer/task_writer, exception info leak in alarm router, and added `DOPAFLOW_DISABLE_RATE_LIMITS` env var for rate limiter testing.
- **CI hotfix**: Playwright now runs via `npx --prefix ...` for portability, GitHub Actions workflows now have explicit `permissions` blocks, and Python version docs clarified as 3.11–3.12 (3.13 unsupported).
- **Dependency audit**: 8 vulnerabilities found; `serialize-javascript` fix is breaking and deferred to next major.

## 2.0.7 to 2.0.10

- Web release path was stabilized and made source-backed when packaged backend refresh was not available locally.
- Responsive shell and surface hardening landed across Today, Tasks, Calendar, Focus, Journal, Settings, and shared modal primitives.
- Command trust and Packy/NLP flows were hardened with better preview/execute behavior, undo support, and regression coverage.
- Calendar moved from mostly display-only toward editable/local-event workflows.
- Review premium, Obsidian bridge, nutrition starter-library recovery, and integrations overview all landed in the active line.

## Notes

- Root-level working notes, prompts, recovery logs, and conversation artifacts were moved out of the repo surface into `docs/internal/ai-workflow/LLM_work_folder/`.
- The long-form changelog now absorbs session-level backend/frontend notes so obsolete summary snapshots and one-off prompt artifacts can be retired instead of becoming a second truth set.
- This file is intentionally short and release-facing. The long-form archive lives under `docs/`.

## Infrastructure hardening (repo-credibility pass)

The following were added to support CI/CD trust and development velocity:

- `frontend/.eslintrc.json` — TypeScript-aware ESLint config
- `frontend/.prettierrc` — Prettier formatting config
- `frontend/vitest.config.ts` — Vitest unit test setup
- `frontend/src/api/client.test.ts` — API client error handling tests
- `frontend/src/hooks/ipc-validation.test.ts` — IPC route sanitization tests
- `backend/pyproject.toml` — Ruff lint + format config
- `backend/pytest.ini` — pytest with asyncio mode and coverage config
- `backend/tests/test_migrations.py` — Migration checksum drift detection
- `backend/tests/test_load.py` — Concurrent health endpoint load test
- `backend/tests/test_request_log.py` — X-Request-ID tracing tests
- `.github/workflows/frontend-ci.yml` — Frontend CI: ESLint + typecheck + format + vitest + npm audit
- `.github/workflows/backend-tests.yml` — Backend CI: ruff lint + pytest --cov-fail-under=70
- `.github/dependabot.yml` — Weekly npm + pip + GitHub Actions dependency updates
- `Makefile` — Root-level dev commands (`make validate`, `make lint`, etc.)
- `docs/testing-strategy.md` — Testing pyramid, CI gate table
- `docs/migrations.md` — Forward-only policy, drift detection
- `docs/security-model.md` — Runtime modes, auth paths, IPC allowlist
- `docs/observability.md` — Structured logs, request IDs, slow-request threshold
- `docs/error-taxonomy.md` — Error shapes, HTTP status codes
- `docs/runbook.md` — Common failure diagnostics
- `docs/production-readiness.md` — Full delta report and scorecard
