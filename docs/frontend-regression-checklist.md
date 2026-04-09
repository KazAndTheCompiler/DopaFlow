# Frontend Regression Checklist

Run this checklist before cutting a desktop or tagged release.

## Required Commands

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:e2e:smoke
npm --prefix frontend run test:e2e:core
npm --prefix frontend run test:e2e:release
```

## Shell and Navigation

- Launch the app and verify the default route lands on the Today surface.
- Confirm sidebar navigation renders all expected first-class routes.
- Confirm mobile navigation and the mobile drawer both render from the shared route manifest.
- Verify command palette navigation still opens Focus and other core surfaces.
- Verify notifications inbox opens without covering or hiding primary shell controls.

## Today and Daily Loop

- Today shows the next focus task, backlog context, and next event without stale copy.
- The Today CTA can move directly into Focus with the suggested task prefilled.
- Shutdown opens, advances, goes back, and completes without losing defer selections.
- Digest still explains momentum in human language rather than raw counters only.

## Tasks, Habits, Goals, Focus, Calendar

- Tasks quick add works and the task appears immediately.
- Task completion updates the row state without crashing.
- Habits can be created and checked in.
- Goals can be created with milestones.
- Focus can start from a selected task and show session history.
- Calendar events open in the details modal and local events remain editable.

## Settings and Vault

- Settings renders integrations overview, vault, sync/sharing, and integrations sections.
- Vault status loads without crashing when disabled.
- Vault bridge actions render correctly when enabled.
- Calendar sharing screens still expose token and feed management.

## Breakpoints

- Verify shell controls remain visible at compact mobile width.
- Verify the mobile drawer stays reachable and route buttons remain tappable.
- Verify desktop sidebar and top shell controls stay visible at common laptop widths.

## Release Notes

- Record the current largest frontend chunks from `vite build`.
- Note any newly added routes, overlays, or app-level providers.
- If a test needed selector updates, confirm the selector is tied to stable user-visible structure rather than decorative copy.
