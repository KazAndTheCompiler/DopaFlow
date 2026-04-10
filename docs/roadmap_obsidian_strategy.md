# DopaFlow Roadmap Audit And Obsidian Strategy

Audited on 2026-04-05 against the working tree.

## Positioning

Best product direction:

`DopaFlow is a local-first ADHD operating system that plugs into Obsidian.`

That is stronger than trying to win as a generic task app. The repo already has credible action surfaces, Markdown journal data, wikilinks, local storage, and optional OAuth-based integrations. The highest-leverage move is to make DopaFlow the execution layer on top of a user-owned knowledge layer instead of becoming a broad SaaS clone.

## Top 10 User-Facing Gaps

Ranked by combined user impact, implementation cost, and strategic leverage for a solo-maintained local-first product.

| Rank | Gap | User impact | Cost | Strategic leverage | Evidence in repo |
|---|---|---:|---:|---:|---|
| 1 | No Obsidian / Markdown vault interoperability | 10 | 7 | 10 | Journal already stores markdown + wikilinks, but there is no vault sync layer or Obsidian bridge |
| 2 | Voice command flow is still command-word-first and brittle for calendar capture | 9 | 5 | 9 | `VoiceCommandModal.tsx`, `commands/service.py`, `next_steps.md` all call this out |
| 3 | Calendar scheduling is still not mature drag/drop editing across the real calendar surface | 9 | 6 | 8 | README and roadmap still list drag-to-reschedule as unfinished; `today/TimeBlocks.tsx` has partial drag behavior but not a full calendar editing story |
| 4 | Integrations feel siloed and settings-driven instead of like an action hub | 8 | 5 | 8 | Settings currently separates Gmail/GitHub/Webhooks/Calendar Sharing/Turso into static panels with no unified integration state model |
| 5 | Mobile capture and fast completion are still incomplete | 8 | 5 | 7 | `TaskRow.tsx` has swipe support, but README still lists mobile swipe-to-complete as a known gap and broader mobile capture is thin |
| 6 | Focus runtime trust still needs hardening on state continuity, retries, and release parity | 8 | 4 | 8 | `next_steps.md` still lists this as immediate priority #1 |
| 7 | Daily-loop polish is uneven across transitions, empty/error/loading states, and perceived premium feel | 7 | 4 | 8 | Skeleton work is better now, but roadmap still calls for calmer Today/Focus/Habits behavior |
| 8 | Review is credible but not yet premium: weak stats/dashboard and limited bridgeability | 7 | 5 | 7 | Review exists, APKG import exists, but changelog still lists review dashboard and trust work as ongoing |
| 9 | Import/export and lock-in messaging are still weaker than they should be | 7 | 4 | 9 | Journal backup exists, but there is no broad “you can leave with your data” story across tasks/review/calendar/project notes |
| 10 | Offline/mobile conflict handling and rollback are not exposed as first-class UX across user data flows | 6 | 6 | 8 | Local-first posture exists, but sync conflict handling is mainly calendar-specific and there is no broad user-facing rollback model |

## Highest-Leverage Roadmap

Only the highest-leverage gaps should drive the next roadmap.

### Tier 1

1. Obsidian bridge
2. Voice -> calendar/task/journal capture that feels reliable and natural
3. Calendar editing and scheduling maturity
4. Integration hub UX

### Tier 2

5. Mobile capture + offline completion polish
6. Focus runtime trust
7. Review premium pass

### Tier 3

8. Broader import/export and migration polish

## What To Deprioritize

Do not spend the next cycle on unrelated breadth:

- new standalone modules
- cloud-first multi-user systems
- large SaaS collaboration features
- more novelty integrations before the integration model is coherent
- cosmetic expansion without stronger execution flows

## Obsidian Strategy

### Product Goal

Make DopaFlow interoperable with a plain Obsidian vault without requiring users to abandon Obsidian conventions.

### Core Principle

DopaFlow owns workflow state and fast execution UX.
Obsidian owns durable plain-text knowledge, references, and plugin ecosystem leverage.

### Minimal Bridge

The minimal bridge should support:

1. Read and write journal notes to an Obsidian vault.
2. Read and write tasks as Markdown checklist items.
3. Read and write daily notes using Obsidian-style date-based file naming.
4. Read and write review cards in Markdown note form with frontmatter.
5. Preserve wiki links, embeds, headings, frontmatter, and file names without lossy conversion.

## Vault Compatibility Rules

### File model

- Journal daily notes:
  - default path: `Daily/YYYY-MM-DD.md`
- Project notes:
  - default path: `Projects/<slug>.md`
- Review cards:
  - default path: `Review/<deck>/<card-id>.md`
- Digest:
  - default path: `Daily/Review/YYYY-MM-DD-digest.md` or append to daily note section
- Task inbox:
  - default path: `Tasks/Inbox.md`

### Markdown compatibility

Preserve:

- `[[wikilinks]]`
- `![[embeds]]`
- standard headings
- YAML frontmatter
- fenced code blocks
- Obsidian-compatible file naming
- unchecked/checked task syntax:
  - `- [ ]`
  - `- [x]`

### Frontmatter conventions

For notes DopaFlow creates, use small explicit frontmatter instead of opaque blobs.

Example:

```md
---
dopaflow_type: task
dopaflow_id: task_123
status: todo
priority: 1
due: 2026-04-06
project: Launch side project
tags:
  - work
  - deep
---
```

That makes the notes usable by Obsidian plugins instead of trapping state in a hidden format.

## Surface Mapping To Obsidian

### Tasks

- DopaFlow tasks map to Markdown checklist items plus optional frontmatter-backed task notes.
- Expose metadata so Obsidian Tasks and Dataview can query:
  - status
  - due date
  - priority
  - project
  - tags

### Journal

- DopaFlow daily journal maps directly to Obsidian daily notes.
- Preserve inline wikilinks and section headings.
- Templates should align with Periodic Notes and Templater conventions where possible.

### Review

- Review decks map to folders or tagged note groups.
- Review cards can be represented as Markdown files with frontmatter:
  - front
  - back
  - ease
  - interval
  - next_review_at

### Digest

- Daily digest can export as a section appended to the daily note or as a sibling note.

### Calendar

- Calendar events should be exportable to notes or summaries, but should not force a Markdown-only calendar model.
- The bridge should prioritize task-block references and day-plan summaries over inventing a custom calendar file format.

### Project Notes

- Project note files become the canonical narrative layer.
- DopaFlow project/task surfaces should link back to the corresponding Markdown file using wikilinks.

## Bidirectional Sync Model

### Model

Use a local file-indexed sync engine with a state table in DopaFlow.

Track:

- file path
- file hash
- last modified timestamp
- mapped DopaFlow entity id
- last sync direction
- sync status
- rollback snapshot reference

### Directions

- DopaFlow -> vault:
  - write normalized Markdown safely
- vault -> DopaFlow:
  - detect file changes and parse compatible structures back into entities

### Change detection

Prefer:

1. filesystem watch where available
2. periodic scan fallback
3. startup reconciliation scan

### Conflict handling

Conflicts should not auto-merge silently.

Use:

- three-way comparison when possible
- conflict status on the entity
- preview diff before overwrite
- explicit choices:
  - keep DopaFlow version
  - keep vault version
  - duplicate into conflict copy

### Safe rollback

Before writes:

- keep a shadow copy or prior content snapshot
- maintain a bounded local history log
- allow one-click rollback per changed file batch

## Attachments And Media

Use Obsidian-compatible vault structure:

- `Attachments/` default folder
- preserve relative links
- do not rewrite filenames unnecessarily
- when DopaFlow exports media-backed journal entries or alarm assets, copy files into the configured attachment folder and reference them using standard Markdown or Obsidian embed syntax

## Optional Obsidian Plugin

### Minimal plugin

The optional plugin should be small and avoid becoming a second app.

Useful responsibilities:

- announce the active vault path to DopaFlow
- expose live note metadata over localhost
- trigger refresh on file save/change
- provide vault-specific settings:
  - daily note folder
  - attachments folder
  - review folder
  - project folder

### Alternative path

If a plugin is not yet shipped, support:

- direct vault-folder selection in DopaFlow
- filesystem watch + polling fallback
- optional localhost bridge later

## Import / Export Without Lock-In

Ship:

1. Vault import wizard:
   - detect daily notes
   - detect tasks
   - detect project notes
   - detect review-card notes
2. Vault export profiles:
   - journal-only
   - tasks + project notes
   - full bridge
3. Entity-level export:
   - one note
   - one project
   - one review deck
4. Dry-run preview before imports and overwrites

## Integration Hub Direction

The current settings-based integrations are technically functional but structurally weak.

Replace the siloed model with a hub model:

- one “Integrations” overview surface
- each provider gets:
  - connected / not connected
  - sync direction
  - last sync
  - error state
  - toggle for enabled surfaces
- OAuth-backed providers should feel like optional switches, not form dumps

Priority order:

1. Obsidian vault
2. Calendar providers
3. GitHub
4. Gmail
5. Webhooks

## Recommended Small-Release Sequence

### Release 1: Obsidian foundation

- vault selection
- file index table
- daily note read/write
- journal export/import
- rollback snapshots
- docs for compatibility rules

### Release 2: Task bridge

- Markdown checklist import/export
- Dataview-friendly frontmatter
- project note linking
- conflict UI for task files

### Release 3: Voice + calendar maturity

- stronger preview/confirm/execute path
- natural phrasing expansion beyond strict command words
- drag/drop and resize for time blocks
- retries and clearer state handling for scheduling

### Release 4: Integration hub

- unified connection state model
- toggle-style settings
- health/status cards
- shared sync patterns across providers

### Release 5: Review + premium polish

- Markdown-backed review notes
- richer stats
- screenshots, changelog, migration guide, and regression coverage

## Suggested Immediate Next Build

If only one strategic build starts now:

`Build the Obsidian foundation layer first, starting with journal daily notes and Markdown task interoperability.`

That is the highest-leverage move because it:

- strengthens the local-first story
- creates a real moat
- improves trust and data portability
- makes later integrations feel coherent
- positions DopaFlow as an execution layer, not just another task app
