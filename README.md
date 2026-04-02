# DopaFlow

**A productivity app built by an ADHD brain, for ADHD brains.**

Most productivity apps hide 90% of their features behind a paywall and assume you already have your life together. DopaFlow doesn't. It's offline-first, has no subscription, and gives you everything upfront.

---

## What it does

DopaFlow brings tasks, habits, focus, journaling, calendar, alarms, and spaced repetition into one place — without the cognitive overhead of switching between five different apps.

| Surface | What it covers |
|---|---|
| **Tasks** | Full CRUD, subtasks, priorities, time logging, Kanban & Eisenhower boards, bulk operations, natural language quick-add |
| **Habits** | Daily check-ins, streaks, freeze/unfreeze, correlation insights, progress rings, heatmap |
| **Focus** | Pomodoro sessions, task picker, custom duration, session history and stats |
| **Journal** | Markdown editor, voice dictation, wikilinks, version history, auto-export to `.md`, templates |
| **Calendar** | Events, Google Calendar sync with conflict resolution, peer calendar sharing for families |
| **Alarms** | Schedule alarms, TTS or YouTube audio queue, background service worker |
| **Review** | Spaced repetition (SM-2), Anki import, deck management |
| **Packy** | Contextual memory system — associates words and context to help you remember better |
| **Digest** | End of day summary, momentum score, weekly insights |
| **Gamification** | XP, badges, levels — because dopamine helps |

---

## Why offline-first

Your data lives on your device. No account required. No cloud dependency. No subscription.

Optional Google Calendar sync uses OAuth — your credentials are never stored in the app, only in your own `.env`.

---

## Tech stack

- **Frontend:** React 18 + TypeScript strict + Vite + PWA
- **Backend:** FastAPI + SQLite (local) or Turso (optional cloud)
- **Desktop:** Electron shell
- **Skins:** 19 built-in themes including gradient skins

---

## Two versions

| | Dev (this repo) | Stable |
|---|---|---|
| **Cost** | Free | $1 |
| **Updates** | Pull manually | Auto-updates when pushed |
| **Status** | Active dev branch | Tested, tagged releases |
| **Support** | None | None (but issues welcome) |

👉 **[Get the stable build on Gumroad](#)** — $1, pay what you want above that.

---

## Getting started (dev)

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

### PWA (install on mobile)

Build the frontend and serve it over HTTPS, then use your browser's "Add to Home Screen" option.

```bash
cd frontend
npm run build
npm run preview
```

---

## Skins

19 built-in themes: `ink-and-stone`, `midnight-neon`, `warm-analog`, `vampire-romance`, `deep-ocean`, `forest-gradient`, `ocean-gradient`, `amber-night`, and more.

A **Skin Maker** tool is included for building your own.

---

## Known gaps (v2 beta)

- No skeleton loaders yet (surfaces show blank briefly while loading)
- Digest email delivery not wired (endpoints exist, scheduled send does not)
- Drag-to-reschedule in calendar time blocks not implemented
- Mobile swipe-to-complete on task rows not implemented

See `CHANGELOG.md` for full history and roadmap.

---

## License

**Personal use only.** You may run, modify, and learn from this code for personal non-commercial use. Redistribution, resale, or commercial use without permission is not allowed.

For anything else, open an issue and ask.

---

## A note

This was built on legacy 2011–2012 hardware, unmedicated, over several hundred hours of fixating. If it helps you, consider grabbing the stable build for $1. It keeps the project alive and might eventually fund a laptop that doesn't sound like a jet engine.

No pressure. The dev version is here either way.
