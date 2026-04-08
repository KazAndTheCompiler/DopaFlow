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

## Remaining Weaknesses

- Browser-level visual verification is still partially blocked in this Codex environment because the local headless browser runtime is incomplete; recovery verification is currently based on source inspection, successful production builds, and a running installed local web release.
- Multiple major surfaces still contain desktop-biased layout rules that need targeted overflow hardening.
- Some startup data loading still uses direct fetch logic instead of guarded shared-client access.
- Manual flow verification across every primary product loop is still incomplete in this environment because Playwright could not launch a fully working browser/runtime stack here.

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
