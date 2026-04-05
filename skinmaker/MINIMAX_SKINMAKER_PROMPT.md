# Minimax Skinmaker Prompt

Use this when working on `skinmaker/` or when promoting a new skin into the main app.

## Goal

Improve DopaFlow's skin system without producing disconnected "pretty mockup" output.

The result must:

- work inside the existing DopaFlow shell
- preserve readability across Today, Tasks, Habits, Focus, Calendar, Settings
- ship as a real production skin or a real skinmaker upgrade
- respect that DopaFlow now has both `theme` and `layout density` controls

## Required Constraints

1. Do not redesign the app from scratch.
2. Do not introduce a skin that only looks good on a marketing card.
3. Preserve the current token model and manifest-driven skin picker.
4. Prefer upgrades that help users make or ship skins faster.
5. If adding a new skin, include:
   - name
   - category
   - accessibility note
   - preview colors
   - JSON vars
6. If upgrading SkinMaker, prioritize:
   - better production export
   - clearer token grouping
   - support for evaluating shell readability
   - guidance for how a skin behaves under `compact`, `comfortable`, and `expanded` layout modes

## High-Value Work

- Add better preview panels for:
  - Today runway
  - task list density
  - focus timer state
  - settings cards
- Improve export so a skin is easier to promote into:
  - `frontend/public/skins/*.json`
  - `frontend/public/skins/manifest.json`
- Add a "ship-ready" checklist inside SkinMaker:
  - contrast
  - active/accent readability
  - destructive state visibility
  - chart/card distinction
  - shell/sidebar readability

## Avoid

- purple-by-default output
- dark-mode bias as the only premium aesthetic
- token churn that breaks old skins
- one-off CSS that bypasses the shared token system

## Deliverables

Ship one of these, not a vague proposal:

1. a concrete SkinMaker feature improvement
2. a production-ready new skin with manifest updates
3. a stronger export/import path for custom skins
4. a shell readability preview upgrade tied to real DopaFlow surfaces
