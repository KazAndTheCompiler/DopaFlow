# Obsidian Vault Bridge

DopaFlow now includes a local-first Obsidian vault bridge.

This bridge is designed to keep your notes readable in Obsidian while giving DopaFlow a safe way to sync journal and task workflows without turning the vault into an opaque app database.

## What works now

- Configure a local vault path in Settings
- Push and pull journal daily notes
- Push and pull DopaFlow-owned task collection files
- Push a bounded daily task section into an existing daily note
- Preview and import vault task lines from DopaFlow-owned collections and plain markdown task files in the configured task folder
- Review vault conflicts, preview both sides, and choose rollback or keep-vault resolution

## Current folder layout

- Daily notes: `Daily/YYYY-MM-DD.md`
- Task collections:
  - `Tasks/Inbox.md`
  - `Tasks/<project-slug>.md`

## Compatibility rules

- Notes stay plain Markdown
- Task checkboxes use Obsidian-compatible syntax:
  - `- [ ] task`
  - `- [x] task`
- DopaFlow identity is stored in hidden HTML comments like `<!--df:tsk_123-->`
- User-authored content outside DopaFlow-managed sections is preserved
- Daily task injection only modifies the bounded `dopaflow:tasks` section

## Manual sync model

The bridge is manual-first.

What that means:

- no live filesystem watch
- no cloud dependency
- no background merge engine
- conflict review is explicit

## Task import rules

The current import flow is intentionally narrow:

- it scans DopaFlow-owned task collection files and plain markdown task files in the configured task folder
- it previews importable lines before creating anything
- it writes new DopaFlow IDs back into the source file after import
- repeated imports of the same source line are guarded by a stable source locator

What it does not do yet:

- import tasks from arbitrary non-DopaFlow Obsidian files
- infer missing projects that do not already exist in DopaFlow
- provide a diff/merge UI

## Conflict behavior

When both the DopaFlow-side content and the indexed vault file have changed since the last sync, DopaFlow marks a conflict instead of overwriting the vault file.

Current user actions:

- inspect a compact line-level diff summary
- preview the current vault file against the last indexed DopaFlow snapshot
- rollback to DopaFlow snapshot
- keep vault version

## Recommended user workflow

1. Set the vault path in Settings.
2. Enable the bridge.
3. Push journal notes and task collections once to establish indexed files.
4. Use preview/import for new vault task lines that should become DopaFlow tasks.
5. Use the daily task section push when you want today’s tasks inserted into an existing daily note.
6. Resolve any reported conflicts before doing more writes to the same files.

## Known limitations

- no live watch
- no merge UI
- no arbitrary vault-wide task import outside the configured task folder
- no attachment/media sync yet
- no Obsidian plugin companion yet
