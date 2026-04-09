# DopaFlow Changelog

Concise release-facing changelog for the current product line.

For the full historical session log and detailed rollout notes from `2.0.0` through
`2.0.11`, see
[`docs/CHANGELOG_2.0.0-2.0.11.md`](/home/henry/vscode/build/dopaflow/docs/CHANGELOG_2.0.0-2.0.11.md).

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

## 2.0.7 to 2.0.10

- Web release path was stabilized and made source-backed when packaged backend refresh was not available locally.
- Responsive shell and surface hardening landed across Today, Tasks, Calendar, Focus, Journal, Settings, and shared modal primitives.
- Command trust and Packy/NLP flows were hardened with better preview/execute behavior, undo support, and regression coverage.
- Calendar moved from mostly display-only toward editable/local-event workflows.
- Review premium, Obsidian bridge, nutrition starter-library recovery, and integrations overview all landed in the active line.

## Notes

- Root-level working notes, prompts, recovery logs, and conversation artifacts were moved out of the repo surface into the ignored `LLM_work_folder/`.
- The long-form changelog now absorbs session-level backend/frontend notes so obsolete summary snapshots and one-off prompt artifacts can be retired instead of becoming a second truth set.
- This file is intentionally short and release-facing. The long-form archive lives under `docs/`.
