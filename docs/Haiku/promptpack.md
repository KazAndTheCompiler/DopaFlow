# Claude Haiku Prompt Pack — DopaFlow

**Model fit:** fast, narrow implementation edits with low ambiguity.
**Use for:** single-file fixes, tiny hook/router changes, low-risk UI cleanup, lint cleanup, dead code removal, and small follow-on polish after a larger implementation pass.
**Do not use for:** migrations, broad refactors, multi-domain backend changes, security reviews, full workflow redesign, or broad UI strategy.

## Actual Role

Claude Haiku is not the “general helper.”
Claude Haiku is the narrow implementation closer.

The team split is:
- User: product direction and priorities
- Codex + Claude Sonnet: main implementation ownership
- Claude Haiku: contained implementation packets after direction is already clear
- Minimax: tests and health
- Qwen: docs and handoff quality

If a task requires broad judgment, use `Claude Sonnet` instead.
If the task is contained and should be finished quickly without philosophical drift, use `Claude Haiku`.

## Working rules

1. Read the target file before editing it.
2. Keep scope tight. Prefer one file, or one file plus its directly coupled test/doc.
3. Match local patterns:
   - Frontend uses inline styles plus CSS tokens.
   - Hooks usually expose `loading`, `error`, async mutation helpers, and `showToast()`.
   - Backend routers are thin when done well, but some domains still call repositories directly.
4. Do not invent architecture. Follow the existing file’s style.
5. If a UI cleanup still feels cheap or half-finished, say it needs Sonnet instead of faking completeness.
6. After patching, confirm the exact behavior changed and nothing else.

## High-value references

- `frontend/src/hooks/useTasks.ts`
- `frontend/src/hooks/useHabits.ts`
- `frontend/src/design-system/primitives/Button.tsx`
- `frontend/src/design-system/primitives/Toast.tsx`
- `backend/app/domains/tasks/router.py`
- `backend/app/domains/calendar/router.py`

## Prompt templates

### 1. Targeted bug fix

```text
Read /home/henry/vscode/build/dopaflow/{file_path} first.

Fix the bug at or near line {line_number}.

Issue:
{one sentence}

Expected behavior:
{one sentence}

Constraints:
- Keep the change limited to the immediate fix
- Do not refactor unrelated code
- Preserve existing coding style

After editing:
- Summarize the exact change
- Confirm whether any follow-up validation is still needed
```

### 2. Small hook adjustment

```text
Read /home/henry/vscode/build/dopaflow/frontend/src/hooks/use{Domain}.ts first.

Make this small hook change:
{describe change}

Requirements:
- Keep the public return shape stable unless explicitly requested
- Use showToast() for user-visible failures
- Keep loading/error handling consistent with the rest of the hook
- Do not rewrite unrelated mutations

After editing:
- Show the returned fields that changed
- Note any caller updates required
```

### 3. Single endpoint patch

```text
Read these files first:
- /home/henry/vscode/build/dopaflow/backend/app/domains/{domain}/router.py
- /home/henry/vscode/build/dopaflow/backend/app/domains/{domain}/repository.py

Apply this targeted endpoint change:
{describe change}

Constraints:
- Limit the change to one endpoint and the minimal repository/service plumbing it needs
- Keep FastAPI typing explicit
- Use Query bounds if adding user-controlled pagination or limits
- Do not touch unrelated routes

After editing:
- Name the endpoint changed
- State whether response shape changed
```

### 4. Console and dead-code cleanup

```text
Read /home/henry/vscode/build/dopaflow/frontend/src/{file_path} first.

Clean up only obvious low-risk issues:
- debug console statements with no user value
- unused imports
- unused local variables
- stale state that is written but never read

Rules:
- Replace real user-facing failure logs with showToast() only if the user needs feedback
- Otherwise remove the debug noise entirely
- Do not remove anything that might be used indirectly

List findings, then apply the cleanup.
```

### 5. Type tightening in one file

```text
Read these files first:
- /home/henry/vscode/build/dopaflow/frontend/src/{file_path}
- /home/henry/vscode/build/dopaflow/shared/types/index.ts

Tighten the types in the target file without changing behavior.

Requirements:
- Replace any/implicit-any with the narrowest correct type
- Reuse shared types when they fit
- Add a local interface only if no shared type matches
- Do not change runtime logic

After editing:
- List the types you introduced or replaced
```

## Good Haiku tasks in this repo

- Add `loading` or `error` wiring to a single hook.
- Tighten one component’s props.
- Fix a null-check or empty-state regression in one surface.
- Add query bounds to one list endpoint.
- Remove stray frontend debug logging.
- Update one doc table to match one router.
- Clean one leftover utility-panel surface so it matches the newer product language.
- Normalize one old button/chip/empty-state treatment after a larger UI pass.

## Bad Haiku tasks in this repo

- “Refactor the review domain.”
- “Audit all auth and scope usage.”
- “Design a better promptpack system.”
- “Rewrite the calendar sharing flow.”
- “Close the full daily-loop gap with paid tools.”
