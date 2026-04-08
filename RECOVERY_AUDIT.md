# DopaFlow Recovery Audit

## Root Causes

### 2026-04-08 Initial findings

- Frontend boot path confirmed: `frontend/src/main.tsx` -> `frontend/src/App.tsx` -> route-to-surface switch -> `frontend/src/shell/Shell.tsx` -> `<main>` outlet.
- Default startup route is `today`, derived by `getRouteFromHash()` in `frontend/src/App.tsx`.
- The startup surface can also trigger the planning modal shortly after mount if `zoestm_planned_date` is not set for today.
- CSS imports are present and ordered correctly in `frontend/src/main.tsx`; missing global CSS was not the active failure.
- The visible-shell regression was in `frontend/src/shell/Shell.tsx`: a full-shell vignette overlay existed in the same stacking context as the real content, while the main content area lacked explicit stacking and shrink constraints.
- `frontend/src/App.tsx` used a surface error boundary that swallowed actionable diagnostics and degraded failures to `Surface failed to render.` without logging root cause details.
- Several shell/surface layouts are desktop-first and vulnerable to overflow because they rely on grid/flex children without consistent `min-width: 0` / `min-height: 0`.

## Exact Fixes Shipped

### 2026-04-08 Patch 1

- Added this audit file to keep a running recovery record.
- Hardened the shell/container path so the main content area can shrink instead of collapsing or overflowing out of the grid.
- Upgraded the surface error boundary to log real diagnostic data to the console and render a more useful development fallback.
- Files changed:
  - `frontend/src/shell/Shell.tsx`
  - `frontend/src/App.tsx`

### 2026-04-08 Patch 2

- Removed a brittle desktop minimum from the top bar center column so the command bar no longer forces the shell wider than the viewport on mid-width desktop sizes.
- Added responsive collapse behavior to `Journal` and `Focus`, both of which previously stayed in two-column mode even when the available width was too narrow to support it safely.
- Added `minWidth: 0` / wrapping protections to these surfaces so content stays inside the main outlet instead of escaping horizontally.
- Files changed:
  - `frontend/src/shell/TopBar.tsx`
  - `frontend/src/surfaces/journal/index.tsx`
  - `frontend/src/surfaces/focus/index.tsx`

### 2026-04-08 Patch 3

- Replaced a raw startup quote fetch on `Today` with the shared API client and cancellation guard so backend failure still preserves the visible surface without stray async updates.
- Replaced the raw Eisenhower board fetch on `Tasks` with the shared API client so backend/network failures follow the same guarded error path as the rest of the app.
- Build verification caught two implementation mistakes during recovery (`exactOptionalPropertyTypes` state shape and duplicate shell style key); both were corrected immediately before proceeding.
- Files changed:
  - `frontend/src/surfaces/today/index.tsx`
  - `frontend/src/surfaces/tasks/index.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/shell/Shell.tsx`

### 2026-04-08 Patch 4

- Hardened `Today` header/actions so the startup surface keeps its controls onscreen instead of forcing a horizontal push when the shell narrows.
- Hardened `Calendar` navigation rows and blocking sidebar so week/day/month controls wrap before overflowing, and removed direct render-time `window.innerWidth` dependence in favor of responsive state.
- Hardened `Settings` integration rows and vault sync rows so status pills and action buttons collapse safely instead of clipping long labels or pushing the panel wider than the viewport.
- Added `matchMedia` guards so the responsive helpers used in this pass do not create a new boot failure in runtimes where `window` or `matchMedia` is unavailable during initialization.
- Files changed:
  - `frontend/src/surfaces/today/index.tsx`
  - `frontend/src/surfaces/calendar/index.tsx`
  - `frontend/src/surfaces/settings/IntegrationsOverview.tsx`
  - `frontend/src/surfaces/settings/VaultSettings.tsx`

### 2026-04-08 Patch 5

- Fixed the shared modal primitive so dialogs size against the viewport with `width`/`maxWidth` instead of a misleading `minWidth`, which could still force panels wider than the screen on tighter desktops.
- Hardened the modal header so long titles and the close button wrap safely instead of colliding or clipping.
- Added `matchMedia` guards to the remaining shell and primary-surface responsive state helpers (`Shell`, `TopBar`, `Today`, `Focus`, `Journal`) so the app no longer assumes a fully browser-like runtime during initialization.
- Relaxed rigid stat-card and filter-banner widths on `Tasks` so the task surface keeps wrapping instead of pushing the main pane outward.
- Files changed:
  - `frontend/src/design-system/primitives/Modal.tsx`
  - `frontend/src/shell/Shell.tsx`
  - `frontend/src/shell/TopBar.tsx`
  - `frontend/src/surfaces/today/index.tsx`
  - `frontend/src/surfaces/focus/index.tsx`
  - `frontend/src/surfaces/journal/index.tsx`
  - `frontend/src/surfaces/tasks/index.tsx`

### 2026-04-08 Patch 6

- Corrected the command-center copy so it matches the actual NLP behavior: natural language commands no longer require explicit `task` / `journal` / `calendar` prefixes.
- Moved the command list fetch in the command center onto the shared API client so transport failures follow the same guarded path as the rest of the app.
- Added explicit success/error toast feedback when commands are launched from the command center instead of leaving execution visually silent.
- Fixed a backend command execution bug where `focus.start` passed the database path into the focus service `task_id` slot, corrupting the returned payload and undermining trust in the command system.
- Added a regression test to ensure natural-language focus commands do not leak the DB path into `task_id`.
- Files changed:
  - `frontend/src/surfaces/commands/index.tsx`
  - `backend/app/domains/commands/service.py`
  - `backend/tests/test_commands.py`

### 2026-04-08 Patch 7

- Added a source-backed backend mode to the local web release installer so the installed web release can run the current backend source when the packaged backend artifact is stale.
- Added a Python daemon launcher for that source-backed backend path because this host refuses to execute `setsid` reliably from the generated release script.
- Verified the installed web release now starts its own backend and frontend processes again through the normal `start.sh` path.
- Files changed:
  - `scripts/release_web/install_release_web.sh`

## Remaining Weaknesses

- Browser-level visual verification is still partially blocked in this Codex environment because the local headless browser runtime is incomplete; recovery verification is currently based on source inspection, successful production builds, and a running installed local web release.
- Multiple major surfaces still contain desktop-biased layout rules that need targeted overflow hardening.
- Some startup data loading still uses direct fetch logic instead of guarded shared-client access.
- Manual flow verification across every primary product loop is still incomplete in this environment because Playwright could not launch a fully working browser/runtime stack here.
- The web release installer still copies a prebuilt backend payload from `release/dopaflow-backend-v2` for packaged mode, so Electron/web parity is still split across two backend delivery paths.
- Electron desktop packaging now produces a Linux AppImage with the required desktop runtime closure bundled inside `usr/lib`, but full local GUI launch verification on this host is still limited by host environment issues (`libfuse.so.2` for direct AppImage launch inside Codex, and missing/blocked X display access for unrestricted Electron boot checks).

## Next Highest-Value Recovery Steps

- Harden the highest-risk remaining surfaces: `Today`, `Tasks`, `Calendar`, `Settings`, plus modal-heavy flows.
- Complete manual loop verification against a working browser/Electron runtime: startup, navigation, settings, task create/edit, calendar event create/edit, journal, focus, shutdown/review.
- Replace raw startup-surface fetches with guarded, non-blocking loading where blank or brittle states can occur.

## Verification Notes

### 2026-04-08 Installed web release

- Rebuilt the frontend successfully after Patch 4 with `npm --prefix frontend run build`.
- Refreshed the installed local release with `scripts/release_web/install_release_web.sh /home/henry/release/DopaFlow-2.0.7-web`.
- Restarted the installed release and rechecked the live endpoints:
  - `http://127.0.0.1:8001/` -> `200`
  - `http://127.0.0.1:8000/health` -> `200`
  - `http://127.0.0.1:8000/api/v2/tasks/` -> `200`
- This confirms the current recovery branch still produces a runnable local copy after the latest UI stabilization changes, even though full visual browser automation remains blocked in this Codex environment.

### 2026-04-08 Installed web release recheck

- Rebuilt the frontend successfully after Patch 5 with `npm --prefix frontend run build`.
- Refreshed and restarted `/home/henry/release/DopaFlow-2.0.7-web` again after the shared modal and shell-responsive fixes.
- Rechecked the same live endpoints after restart:
  - `http://127.0.0.1:8001/` -> `200`
  - `http://127.0.0.1:8000/health` -> `200`
  - `http://127.0.0.1:8000/api/v2/tasks/` -> `200`
- This keeps the installed proof copy aligned with the repo after another shared-layout patch set, which matters more than isolated source-only fixes.

### 2026-04-08 Command recovery verification

- Rebuilt the frontend successfully after the command-center copy and feedback fixes.
- Ran `backend/tests/test_commands.py`; all 28 tests passed, including the new regression assertion for `focus.start`.
- Live command smoke tests against the installed web release confirmed the command backend is reachable and executing real actions (`greeting`, `task.create`, `task.list`, `focus.start`, `undo`), but also exposed that the installed backend payload still predates the `focus.start` fix because the web installer copies the prebuilt backend artifact.
- Root cause of that mismatch: `scripts/release_web/install_release_web.sh` copies `release/dopaflow-backend-v2`, and this host cannot currently rebuild that payload because `pyinstaller` requires `objdump`, which is unavailable here.

### 2026-04-08 Installed release source-backend verification

- Updated the local web release installer to launch backend source directly via the repo venv when packaged backend refresh is not available on this host.
- Verified the normal installed release `start.sh` path now keeps both services alive:
  - frontend `serve_release.py`
  - backend `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
- Rechecked the installed release command path through `http://127.0.0.1:8000/api/v2/commands/execute`:
  - `focus.start` -> `status: executed`, `task_id: null`
  - `task.create` -> `status: executed`
  - `hello` -> `status: ok`
- Desktop packaging was reworked so the AppImage/unpacked release now bundles the Linux desktop runtime closure through `desktop/afterPack.js` and the release rebuild scripts.
- Verified against extracted `DopaFlow-2.0.7.AppImage`:
  - `ldd` on the packaged `dopaflow-desktop` resolves bundled deps from `squashfs-root/usr/lib`, including `libnss3.so`, `libxcb-render.so.0`, `libxcb-shm.so.0`, `libXau.so.6`, `libXdmcp.so.6`, `libpixman-1.so.0`, `libgraphite2.so.3`, `libdatrie.so.1`, `libwayland-client.so.0`, `libwayland-cursor.so.0`, `libwayland-egl.so.1`, `libXcursor.so.1`, and `libXinerama.so.1`.
  - the older `DopaFlow-2.0.8.AppImage` still fails that dependency audit on this host, which confirms the new packaging path materially improved the release artifact.
- Remaining local verification blocker:
  - inside Codex confinement, direct Electron startup still dies early in a host-specific sandbox/runtime path
  - outside Codex confinement, the extracted packaged app gets far enough to fail on `Missing X server or $DISPLAY`, which points at local display access rather than a missing packaged library set

### 2026-04-08 Browser smoke verification status

- Browser smoke coverage already exists in `frontend/tests/e2e/`, with narrow mocked regression coverage in:
  - `frontend/tests/e2e/route_startup.spec.ts`
  - `frontend/tests/e2e/app_smoke.spec.ts`
- These tests are the fastest browser-level confidence path because they stub backend calls and only need the frontend dev server plus Playwright browsers.
- Repo-level smoke verification now works on this host when run outside the Codex network sandbox:
  - installed Playwright Chromium browser binaries
  - started the frontend dev server on `127.0.0.1:4173` outside the sandbox
  - ran `route_startup.spec.ts` -> `8 passed`
  - ran `app_smoke.spec.ts` -> `7 passed`
  - ran `tasks_flow.spec.ts` -> `6 passed`
  - ran `daily_loop.spec.ts` -> `7 passed`
  - ran `calendar_maturity.spec.ts` -> `6 passed`
  - ran `focus_flow.spec.ts` -> `4 passed`
  - ran `goals_flow.spec.ts` -> `3 passed`
  - ran `habits_flow.spec.ts` -> `3 passed` after updating stale compact-badge expectations (`ST 0d`, `1/ day`) to match the current habits card UI
- Follow-up hardening shipped during this pass:
  - `frontend/playwright.config.ts` now auto-detects a usable bundled `usr/lib` directory from the current desktop build or unpacked release instead of relying on a single stale hard-coded path
  - `frontend/package.json` now exposes `npm run test:e2e:smoke` for the narrow mocked browser regression path
  - `frontend/package.json` now exposes `npm run test:e2e:core` for the broader mocked browser pass (`route_startup`, `app_smoke`, `tasks_flow`, `daily_loop`)
  - `frontend/package.json` now exposes `npm run test:e2e:release` for the CI release slice (`route_startup`, `app_smoke`, `tasks_flow`, `daily_loop`, `calendar_maturity`, `focus_flow`, `habits_flow`, `goals_flow`)
- Remaining local caveat:
  - the frontend dev server and Playwright runs still need to happen outside the Codex sandbox because sandboxed loopback/networking is restricted in this environment
