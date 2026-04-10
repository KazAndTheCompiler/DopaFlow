# Release Checklist

Use this before tagging a `v*` release.

## Repository Hygiene

Run:

```bash
python3 scripts/check_repo_hygiene.py
```

Required result:

- no tracked private keys or deploy keys
- no secret-like material in tracked files
- `.deploy-keys/` contains only `README.md`

## Backend Verification

Run the touched-domain matrix from the repo root:

```bash
PYTHONPATH=backend DOPAFLOW_DEV_AUTH=true .venv/bin/python -m pytest \
  backend/tests/test_commands.py \
  backend/tests/test_commands_voice.py \
  backend/tests/test_nlp.py \
  backend/tests/test_habits.py \
  backend/tests/test_focus.py \
  backend/tests/test_tasks.py \
  backend/tests/test_goals.py \
  backend/tests/test_projects.py \
  backend/tests/test_boards.py \
  backend/tests/test_auth_scopes.py \
  backend/tests/test_integrations.py \
  backend/tests/test_notifications.py \
  backend/tests/test_digest.py \
  backend/tests/test_review.py \
  backend/tests/vault_bridge/ -q
```

Required result:

- command/NLP trust path passes
- typed domain contracts pass for tasks, focus, habits, goals, projects, boards, review, digest
- vault bridge tests pass
- auth/integration/notification regressions stay green

## Frontend Verification

Run:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:e2e:smoke
npm --prefix frontend run test:e2e:core
npm --prefix frontend run test:e2e:release
```

Required result:

- route registry and overlay orchestration stay type-clean
- shell breakpoint coverage passes as part of core and release suites
- daily loop, tasks, calendar, focus, habits, and goals flows stay green

Supporting docs:

- [frontend architecture](./frontend-architecture.md)
- [frontend regression checklist](./frontend-regression-checklist.md)

## Desktop Verification

Run:

```bash
npm --prefix desktop test
npm --prefix desktop run dist:stable:linux
bash scripts/verify_appimage.sh desktop/dist/DopaFlow-*.AppImage
```

Required result:

- desktop runtime tests pass
- dev auth is explicit opt-in only in development
- preload/window runtime stay sandboxed and route-sanitized
- AppImage payload audit passes

If the vendor runtime bundle needs refreshing:

```bash
.venv/bin/python desktop/scripts/sync-vendor-runtime.py
```

## CI/Tagging

Before tagging:

- confirm `.github/workflows/release.yml` still runs frontend release e2e, desktop tests, packaging, and AppImage verification
- confirm `.github/workflows/repo-hygiene.yml` is present and active

Tag flow:

1. push the branch you want to release
2. create and push `vX.Y.Z`
3. wait for Linux and Windows artifacts plus release publication

## Manual Spot Checks

Do these after the automated gates pass:

- open the desktop app on a real GUI session
- verify Today, Tasks, Focus, Calendar, Settings, and Shutdown still behave normally
- verify external links open externally and untrusted navigations do not hijack the app window
- verify the packaged app icon/branding is no longer the default Electron icon
