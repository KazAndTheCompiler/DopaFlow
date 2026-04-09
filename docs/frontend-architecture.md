# Frontend Architecture

## Purpose

The frontend is a route-driven React shell that keeps navigation, overlays, and domain state separate enough to evolve without turning `App.tsx` back into a god component.

## Composition Root

- `frontend/src/App.tsx`
  Owns top-level orchestration only: route state, command execution, shell wiring, and overlay visibility.
- `frontend/src/appRoutes.tsx`
  Defines the canonical route registry. Route labels, icons, lazy surface imports, sidebar exposure, and mobile-nav exposure all derive from this file.
- `frontend/src/app/AppOverlays.tsx`
  Owns cross-surface overlays such as planning, shutdown, onboarding, inbox, achievements, and command-adjacent global UI.
- `frontend/src/app/AppContexts.tsx`
  Hosts focused app providers and narrow hooks instead of one broad app blob.

## Route Model

Routes are defined once in `routeRegistry` and reused by:

- shell/sidebar navigation
- mobile navigation
- hash routing
- command intent routing
- action routing from Packy or command flows

This removes the older drift between hard-coded nav arrays and route strings scattered across the shell.

## Provider Boundaries

The app-level contexts expose focused hooks such as:

- task state and task mutations
- habits state and check-in actions
- focus sessions and focus controls
- journal, calendar, notifications, skin, and layout state

Surfaces should consume the narrowest possible hook from `AppContexts` instead of depending on a large app object. This keeps rerender scope and coupling lower.

## Async Data Strategy

The current frontend still uses domain hooks rather than a full query library. The hardened pattern is:

- each core domain hook owns its own fetch and refresh contract
- surfaces compose hook state instead of mixing ad hoc `fetch` calls into rendering code
- surface-specific direct API calls should be limited to narrowly scoped UI behavior where a shared hook does not yet exist

`TodayView` no longer forces redundant mount-time refreshes for tasks, habits, insights, and focus, because those hooks already fetch on mount. That change removed avoidable rerender churn and stabilized the daily-loop tests.

## Shell Structure

- `frontend/src/shell/Shell.tsx`
  Layout frame only.
- `frontend/src/shell/ShellMobileNav.tsx`
  Bottom navigation for compact layouts.
- `frontend/src/shell/ShellMobileDrawer.tsx`
  Drawer-specific mobile navigation behavior.

Shell components should render from shared route metadata instead of embedding feature policy or route knowledge locally.

## Testing and Release Gates

Current frontend verification lanes:

- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run build`
- `npm --prefix frontend run test:e2e:smoke`
- `npm --prefix frontend run test:e2e:core`
- `npm --prefix frontend run test:e2e:release`

The Playwright runtime is wrapped through `frontend/scripts/run-playwright.sh` so browser startup works in this environment and in CI with the repo-local runtime libraries.

## Build Snapshot

From the current production build:

- largest emitted chunk: `dist/assets/index-t-yVDC9w.js` at `265.40 kB` (`76.48 kB` gzip)
- next largest chunks: `83.87 kB`, `54.65 kB`, `40.23 kB`

This confirms route-level splitting is active instead of shipping a single large frontend bundle.
