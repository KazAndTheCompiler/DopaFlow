# DopaFlow

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Offline First](https://img.shields.io/badge/Offline--first-no_cloud_required-6B7280?style=flat-square)](#why-offline-first)
[![Get on Gumroad](https://img.shields.io/badge/Stable_build-$1_on_Gumroad-FF90E8?style=flat-square&logo=gumroad&logoColor=white)](https://kirkhenrik.gumroad.com/l/woosbf)
[![License: PolyForm NC](https://img.shields.io/badge/License-PolyForm_NC_1.0-blue?style=flat-square)](LICENSE)

**A productivity app built by an ADHD brain, for ADHD brains.**

This is not a founder story from a co-working space. I built DopaFlow because I needed it and nothing else actually worked for me.

I tried TickTick. Habits are "free" until you need them properly, then you hit a paywall. Sunsama is expensive. Todoist felt like it was designed for someone who already has their life together. Super Productivity came closest, but it still was not quite right. So I built my own.

My background is not tech. I spent years working as a sailor in the North Sea and off the coast of Greenland on anchor handling, tug suppliers, standby rescue vessels, surveys, and offshore construction work. Then I got sick and could not continue. What came after was illness, depression, and eventually finding my way into code. I am 50. I have ADHD. I am currently unmedicated because I cannot afford the medicine. This app exists anyway.

---

## What it does

DopaFlow brings tasks, habits, focus, journaling, calendar, alarms, and spaced repetition into one place without the mental overhead of bouncing between five different apps.

| Surface | What it covers |
|---|---|
| **Tasks** | Full CRUD, subtasks, priorities, time logging, Kanban & Eisenhower boards, bulk operations, natural language quick-add |
| **Habits** | Daily check-ins, streaks, freeze/unfreeze, correlation insights, progress rings, heatmap |
| **Focus** | Pomodoro sessions, task picker, custom duration, session history and stats |
| **Journal** | Markdown editor, voice dictation, wikilinks, version history, auto-export to `.md`, templates |
| **Calendar** | Events, Google Calendar sync with conflict resolution, peer calendar sharing |
| **Alarms** | Schedule alarms, TTS or YouTube audio queue, background service worker |
| **Review** | Spaced repetition (SM-2), Anki import, deck management |
| **Packy** | Contextual memory system to help resurface things you forgot |
| **Digest** | End of day summary, momentum score, weekly insights |
| **Gamification** | XP, badges, levels, because dopamine helps |

---

## Why these features exist

ADHD is dopamine hunting. You build systems around that or you drown in the lack of them. Every feature in DopaFlow came from a real gap, not a product roadmap.

**Smart Memory** came out of roleplay with LLMs, oddly enough. A normal lorebook triggers on exact words. Miss the word and the memory never shows up. Smart Memory stores by association instead. Coffee can become hot drink, morning ritual, warm beverage. The more you use the journal and build those associations yourself, the more your own past entries can resurface when you need them. It is built for the ADHD reality: decent long-term memory, terrible short-term memory, and a habit of losing the thread completely.

**Spaced repetition** is there because it was the first thing in my life that made learned knowledge actually stick. Anki-style repetition forces your brain to encode things properly instead of skating over them. For neurodivergent people, it is far more useful than most schools seem willing to admit.

**Alarms with TTS** exist because some things need to be said out loud. A spoken reminder lands differently than a silent badge. I use that for medicine, routine, and getting out the door. Sometimes I use music for the same reason. Pavlov, basically. But it works.

**Tasks that roll over** exist because I do not want guilt baked into the software. If you planned four hours and the work took six, the task moves. That is not failure. That is information. You adjust the system to your real capacity instead of pretending you are a machine.

**Calorie and habit correlation** exists because people often do not see their own patterns until the data is in front of them. Six cups of coffee, bad sleep, bad evening journal, worse mood. It is easier to fix what you can actually see.

---

## Why offline-first

Your data lives on your device. No account required. No cloud dependency. No subscription.

Optional Google Calendar sync uses OAuth. Your credentials are not baked into the app. You own your data.

---

## Obsidian bridge

DopaFlow now has a local-first Obsidian vault bridge in the working tree and installed web release.

What it supports today:

- vault path/configuration in Settings
- journal push/pull using Markdown daily notes
- task collection push/pull using Obsidian-compatible checkbox syntax
- daily task section push into an existing daily note using bounded markers
- task import preview/import from DopaFlow-owned vault task files
- rollback and conflict tracking for indexed vault files

Current shape of the bridge:

- journal notes live in `Daily/YYYY-MM-DD.md`
- tasks live in `Tasks/Inbox.md` plus one `Tasks/<project>.md` file per project
- DopaFlow-managed task identity is stored in hidden HTML comments like `<!--df:tsk_123-->`
- daily-note task injection only touches the managed `dopaflow:tasks` section, not the rest of your note

What it does not do yet:

- no live filesystem watch
- no cloud sync
- no merge UI
- no import from arbitrary non-DopaFlow Obsidian task files yet

The intended product direction is still the same: DopaFlow as the action layer, Obsidian as the durable plain-text knowledge layer.

See `docs/obsidian_bridge.md` for the current workflow and compatibility rules.

---

## Tech stack

- **Frontend:** React 18 + TypeScript + Vite + PWA
- **Backend:** FastAPI + SQLite or Turso
- **Desktop:** Electron
- **Themes:** 19 built-in skins

---

## Two versions

| | Dev (this repo) | Stable |
|---|---|---|
| **Cost** | Free | $1 |
| **Updates** | Pull manually from GitHub | Auto-updates when pushed |
| **Status** | Active development | Tested, tagged releases |
| **Support** | None | None, but issues are welcome |

👉 **[Get the stable build on Gumroad](https://kirkhenrik.gumroad.com/l/woosbf)** — $1, pay what you want above that.

The dev version stays free. The $1 is not for extra features. You get the same app either way. It is for the easy path: stable builds and automatic updates.

The first version got around a thousand downloads with a voluntary donation link. Nobody donated. That is not a moral failure, it is just reality. But I work on hardware from 2011 and 2012, I cannot afford to replace it, and I cannot keep this project alive on zero. One dollar is the compromise.

---

## Getting started

### Requirements

- Node 18+
- Python 3.11+

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env  # edit as needed
uvicorn app.main:app --reload
```

Frontend runs on `http://localhost:5173`, backend on `http://localhost:8000`.

### PWA

Build the frontend and serve it over HTTPS, then install it from your browser.

```bash
cd frontend
npm run build
npm run preview
```

---

## Who this is for

Primarily people with ADHD. But also anyone with a stressful life, a bad routine, a messy brain, or a history with productivity apps that assume too much about your baseline.

This is not about masking better. It is about ownership. Accountability without guilt. A system you adjust to fit your real life instead of punishing yourself for not fitting the system.

---

## Voice commands

Voice commands are live in the current build with explicit command words:

- `task buy milk tomorrow`
- `journal today felt clearer after walking`
- `calendar dentist tomorrow at 14:00 for 45 minutes`

The current version is deliberately strict. It previews first, asks for confirmation, and speaks back status through browser TTS instead of trying to guess intent from vague speech.

Current active direction:

- tighten the STT command-line flow so spoken calendar commands create real time blocks reliably
- keep typed command parsing and spoken command parsing on the same preview -> confirm -> execute path
- preserve explicit command words until the more freeform layer is actually trustworthy

---

## Known gaps (v2 beta)

- Skeleton loaders are now in place on the core loading-heavy surfaces (`today`, `overview`, `goals`, task/habit/review/journal lists), but the rest of the app still needs a consistency pass
- Obsidian bridge is now real but still manual-first: no live watch, no merge UI, and no import from arbitrary non-DopaFlow task files yet
- Digest email delivery is not wired
- Drag-to-reschedule in calendar time blocks is not implemented
- Mobile swipe-to-complete on task rows is not implemented
- Voice/STT scheduling is in progress: spoken appointments should become confirmed calendar blocks with start/end times
- Shell customization is improving, but layout control is still newer than the skin system and needs a broader pass across surfaces
- Nutrition lost a useful preset starter library during migration; common basics like coffee, tea, sugar-by-teaspoon, and simple sandwich defaults need to come back as protected seed data
- Review import trust is improving, but APKG coverage should keep moving toward real generated-package tests instead of placeholder-only confidence

See `CHANGELOG.md` and `next_steps.md` for the live direction.

---

## Credits

Built by **Henry (KazAndTheCompiler)** — ex-navigator, AuDHD, Jutland, Denmark.

Co-authored with **[Claude](https://claude.ai)** (Anthropic) — pair-programmed across the full stack: FastAPI backend, React frontend, Electron packaging, design system, and skin engine.

---

## License

**Personal use only.** You may run, modify, and learn from this code for personal non-commercial use. Redistribution, resale, or commercial use without permission is not allowed.

For anything else, open an issue and ask.
