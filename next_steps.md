# Next Steps

Last updated: 2026-04-04
Project root: `/home/henry/vscode/build/dopaflow`

## Current State

The product is past the "feature credibility" problem. The remaining work is mostly:

- making the daily loop feel premium instead of merely complete
- removing doc and roadmap drift
- hardening runtime behavior so focus, habits, and release flows stay boring
- turning skins into a broader shell customization story, not just color changes
- finishing the voice/STT command path so spoken capture can create real calendar time blocks
- restoring small-but-important preset nutrition foods that existed before migration and should not have been lost
- proving review imports with real generated `.apkg` fixtures instead of placeholder coverage

## Immediate Priorities

### 1. Focus Runtime Trust

Land and verify:

- live countdown stays visible during active sessions
- active sessions survive list refreshes and route changes
- session history never steals the currently running session out of the timer path
- pause/resume/complete remain stable in web and release builds

Definition of done:

- starting focus always produces a visible active timer
- release and dev builds behave the same way
- E2E asserts the countdown path, not just "session started"

### 2. Today / Focus / Habits Polish

Continue the daily-loop polish pass:

- tighten Today runway guidance and reduce list maintenance friction
- make Focus transitions calmer and clearer
- keep Habits readable when the list grows beyond a handful of cards
- improve empty/loading/error states so the app feels safe on low-energy days

Definition of done:

- Today answers "what now?"
- Focus answers "what is protected right now?"
- Habits answers "what needs one click today?"

### 3. Voice/STT Command Line

Current product direction:

- spoken input should be able to create appointments and time blocks, not just raw text previews
- the system should stay explicit and reliable rather than pretending to understand everything

Build next:

- extend command preview so spoken calendar commands produce real start/end blocks
- support voice-first appointment phrasing like "calendar dentist tomorrow at 14:00 for 45 minutes"
- ensure preview -> confirm -> execute stays consistent across typed commands and STT commands
- keep command word routing explicit (`task`, `journal`, `calendar`) until reliability proves otherwise

Definition of done:

- user can press a button, speak an appointment, confirm, and see a calendar block created

### 4. Shell Customization Beyond Color

Themes exist. Layout control was the missing half.

Now continue with:

- density presets that affect more shared layout primitives
- clearer settings language around theme vs layout
- skinmaker improvements so custom skins include shell/layout guidance, not only token export
- better route-level consistency so skins actually feel different across the whole app

Definition of done:

- user can change both mood and density without editing code
- skinmaker outputs are easier to promote into production skins

### 5. Nutrition Preset Recovery

The older release had a practical starter food library. That survived in user memory but not in the migrated product.

Restore next:

- a protected preset nutrition library with everyday entries like coffee, tea, sugar by teaspoon, and simple sandwich defaults
- migration or first-run seeding so these basics exist in clean installs and upgraded databases
- tests that assert preset foods exist and remain undeletable

Definition of done:

- a new install has a usable starter nutrition library before the user enters custom foods
- migration tests prevent this regression from coming back

### 6. Review Import Trust

The review backend has real APKG import code, but too much of the test surface was still placeholder-only.

Build next:

- keep a generated test `.apkg` path in backend tests
- verify imported cards become due cards in a real deck
- verify imported cards can be rated and enter normal SM-2 scheduling
- later, add one API-level multipart import test to cover the mounted upload route as well

Definition of done:

- imported Anki packages are covered by a non-placeholder test path
- SM-2 scheduling is proven on imported cards, not just manually created ones

### 7. Markdown Truth Set Cleanup

The repo should stop carrying stale snapshot docs as if they were live references.

Keep current:

- `CHANGELOG.md`
- `README.md`
- `next_steps.md`
- `docs/userguide.html`
- `LLM_work_folder/promptpack_agents.md`

Remove or avoid reviving:

- giant frozen audits that contradict the live codebase
- duplicated file maps that drift faster than the repo changes
- old one-off implementation notes once their work is shipped

Definition of done:

- a new contributor can find the live truth in a few files instead of a dozen contradictory ones

## Secondary Priorities

### Reliability

- keep expanding behavior-heavy E2E around daily loop, focus, habits, goals, and commands
- add more runtime fallback messaging where fetch failures currently feel abrupt
- keep release scripts simple enough to rerun without chat back-and-forth
- add backend regression coverage where migrations silently drop useful preset data

### Settings / IA

- make Settings the home for shell customization, not just integrations and backup
- keep onboarding lighter and more route-driven
- group advanced systems so first-run doesn’t feel like a toolbox dump

### Calendar / Sharing

- preserve local-first posture
- make shared-calendar onboarding calmer
- improve stale-sync/status language
- finish drag-to-reschedule after core focus/voice polish is stable

## Product Bar

Every next change should clear most of these:

- faster
- clearer
- calmer
- more trustworthy
- fewer clicks between intent and action
- harder to regress silently

## Best Next Bet

If only one product thread gets full attention after the current fixes:

`Finish the voice/STT calendar command path so spoken capture can reliably become a scheduled block.`
