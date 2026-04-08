"""Persistence helpers for the Packy domain."""

from __future__ import annotations

import datetime
import json
import logging
from uuid import uuid4

from app.core.database import get_db, tx
from app.domains.packy.schemas import MomentumScore, PackyAnswer, PackyAskRequest, PackyLorebookRequest, PackyWhisper

logger = logging.getLogger(__name__)


class PackyRepository:
    """Read and write lightweight Packy context and computed momentum values."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def _ensure_lorebook_tables(self, conn) -> None:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS packy_lorebook (
                session_id TEXT PRIMARY KEY,
                recent_mood TEXT,
                mood_valence REAL,
                active_task_id TEXT,
                active_task_title TEXT,
                completed_today INTEGER NOT NULL DEFAULT 0,
                habit_streak_max INTEGER NOT NULL DEFAULT 0,
                focus_minutes_today INTEGER NOT NULL DEFAULT 0,
                review_cards_done INTEGER NOT NULL DEFAULT 0,
                review_cards_overdue INTEGER NOT NULL DEFAULT 0,
                journal_entry_today INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS packy_lorebook_entries (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                headline TEXT,
                body TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    def answer(self, payload: PackyAskRequest) -> PackyAnswer:
        """Return a neutral ADHD-aware assistant response."""

        achievement = ""
        with get_db(self.db_path) as conn:
            row = conn.execute("SELECT recent_mood FROM packy_lorebook ORDER BY updated_at DESC LIMIT 1").fetchone()
        if row and row["recent_mood"]:
            try:
                mood = json.loads(str(row["recent_mood"]))
                headline = str(mood.get("headline") or "")
                if headline.startswith("Achievement"):
                    achievement = f" Recent win: {headline}."
            except Exception:
                logger.warning("Failed to parse Packy recent_mood payload")
                achievement = ""
        return PackyAnswer(
            intent="unknown",
            extracted_data={"echo": payload.text},
            reply_text=f"Packy heard you. Pick one concrete next step.{achievement}",
            suggested_action="open-command-bar",
        )

    def whisper(self) -> PackyWhisper:
        """Return a proactive shell tip informed by lorebook state and time of day."""

        hour = datetime.datetime.now().hour
        morning = 5 <= hour < 12
        afternoon = 12 <= hour < 17
        evening = 17 <= hour < 21

        with get_db(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM packy_lorebook ORDER BY updated_at DESC LIMIT 1"
            ).fetchone()

        if row:
            r = dict(row)
            focus = r.get("focus_minutes_today", 0) or 0
            habits = r.get("completed_today", 0) or 0
            cards = r.get("review_cards_done", 0) or 0
            journal = r.get("journal_entry_today", 0) or 0
            streak = r.get("habit_streak_max", 0) or 0

            if r.get("recent_mood"):
                try:
                    mood = json.loads(str(r["recent_mood"]))
                    headline = str(mood.get("headline") or "")
                    if headline.startswith("Achievement"):
                        return PackyWhisper(
                            text=f"{headline} — keep the streak alive.",
                            tone="positive",
                            suggested_action="open-habits",
                        )
                except Exception:
                    logger.warning("Failed to parse Packy recent_mood payload during whisper")

            if morning and focus == 0 and habits == 0:
                return PackyWhisper(
                    text="Morning. One habit check-in and one focus block — that's today's foundation.",
                    tone="neutral",
                    suggested_action="open-habits",
                )
            if morning and focus == 0:
                return PackyWhisper(
                    text="Good start on habits. Lock in a 25-minute focus block before noon.",
                    tone="neutral",
                    suggested_action="start-focus",
                )
            if afternoon and focus < 25:
                return PackyWhisper(
                    text="Afternoon lull? A single focus session now beats three rushed ones at 5pm.",
                    tone="neutral",
                    suggested_action="start-focus",
                )
            if afternoon and cards == 0:
                return PackyWhisper(
                    text="Review queue untouched — three cards takes two minutes.",
                    tone="neutral",
                    suggested_action="open-review",
                )
            if evening and journal == 0:
                return PackyWhisper(
                    text="Write two lines before the day closes. Future you will thank you.",
                    tone="neutral",
                    suggested_action="open-journal",
                )
            if evening and focus >= 50:
                return PackyWhisper(
                    text=f"Strong focus day — {focus} minutes logged. Wind down and protect tomorrow's energy.",
                    tone="positive",
                    suggested_action="open-today",
                )
            if streak >= 7:
                return PackyWhisper(
                    text=f"{streak}-day streak. Don't break it for a lazy afternoon.",
                    tone="positive",
                    suggested_action="open-habits",
                )
            if focus >= 75:
                return PackyWhisper(
                    text="Deep work day. Log a journal entry to capture what you learned.",
                    tone="positive",
                    suggested_action="open-journal",
                )
            if habits == 0:
                return PackyWhisper(
                    text="No habits checked in today. One check-in starts the streak.",
                    tone="neutral",
                    suggested_action="open-habits",
                )
            if cards == 0:
                return PackyWhisper(
                    text="Review queue untouched — even three cards counts.",
                    tone="neutral",
                    suggested_action="open-review",
                )

        if morning:
            return PackyWhisper(
                text="Morning is momentum. Pick one task and start before you open anything else.",
                tone="neutral",
                suggested_action="open-today",
            )
        if afternoon:
            return PackyWhisper(
                text="Halfway through the day. What's the one thing that must ship today?",
                tone="neutral",
                suggested_action="open-tasks",
            )
        if evening:
            return PackyWhisper(
                text="Evening review: three done is a good day. Check what carried over.",
                tone="neutral",
                suggested_action="open-today",
            )
        return PackyWhisper(
            text="Rest is part of the system. Queue is safe until tomorrow.",
            tone="neutral",
            suggested_action="open-today",
        )

    def update_lorebook(self, payload: PackyLorebookRequest) -> dict[str, object]:
        """Upsert lorebook context for a session."""

        session_id = payload.session_id or "default"
        with tx(self.db_path) as conn:
            self._ensure_lorebook_tables(conn)
            conn.execute(
                """
                INSERT INTO packy_lorebook (
                    session_id, recent_mood, active_task_title, completed_today,
                    habit_streak_max, focus_minutes_today, review_cards_done, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(session_id) DO UPDATE SET
                    recent_mood = COALESCE(excluded.recent_mood, packy_lorebook.recent_mood),
                    active_task_title = COALESCE(excluded.active_task_title, packy_lorebook.active_task_title),
                    completed_today = excluded.completed_today,
                    habit_streak_max = excluded.habit_streak_max,
                    focus_minutes_today = excluded.focus_minutes_today,
                    review_cards_done = excluded.review_cards_done,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    session_id,
                    json.dumps({"headline": payload.headline, "body": payload.body}) if payload.headline or payload.body else None,
                    payload.headline,
                    payload.completed_today or 0,
                    payload.habit_streak or 0,
                    payload.focus_minutes_today or 0,
                    0,
                ),
            )
            snippet_id = f"lorebook_{session_id}_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO packy_lorebook_entries (id, session_id, headline, body)
                VALUES (?, ?, ?, ?)
                """,
                (snippet_id, session_id, payload.headline, payload.body),
            )
        return {"status": "accepted", "session_id": session_id, "persisted": True, "id": snippet_id}

    def momentum(self) -> MomentumScore:
        """Return the current momentum score derived from live domain data."""

        focus_velocity = 0
        habit_streak = 0
        tasks_done_today = 0
        journal_today = 0
        review_cards_today = 0
        nutrition_today = 0

        try:
            with get_db(self.db_path) as conn:
                focus_velocity = int(
                    conn.execute(
                        """
                        SELECT COUNT(*) AS count FROM focus_sessions
                        WHERE status = 'completed'
                        AND datetime(COALESCE(ended_at, started_at)) > datetime('now', '-7 days')
                        """
                    ).fetchone()[0]
                )
                habit_rows = conn.execute("SELECT id FROM habits WHERE deleted_at IS NULL").fetchall()
                for row in habit_rows:
                    checkins = conn.execute(
                        "SELECT checkin_date FROM habit_checkins WHERE habit_id = ? ORDER BY checkin_date ASC",
                        (row["id"],),
                    ).fetchall()
                    if not checkins:
                        continue
                    current = 0
                    expected_day = None
                    for checkin in reversed([str(item["checkin_date"]) for item in checkins]):
                        if expected_day is None:
                            expected_day = checkin
                        if checkin == expected_day:
                            current += 1
                            expected_day = (
                                datetime.date.fromisoformat(expected_day) - datetime.timedelta(days=1)
                            ).isoformat()
                        else:
                            break
                    habit_streak += current
                try:
                    tasks_done_today = int(
                        conn.execute(
                            "SELECT COUNT(*) FROM tasks WHERE status='done' AND date(updated_at)=date('now')"
                        ).fetchone()[0]
                    )
                except Exception:
                    pass
        except Exception:
            pass

        try:
            with get_db(self.db_path) as conn:
                try:
                    journal_today = int(
                        conn.execute(
                            "SELECT COUNT(*) FROM journal_entries WHERE date(created_at)=date('now')"
                        ).fetchone()[0]
                    )
                except Exception:
                    pass
                try:
                    review_cards_today = int(
                        conn.execute(
                            "SELECT COUNT(*) FROM review_sessions WHERE date(created_at)=date('now')"
                        ).fetchone()[0]
                    )
                except Exception:
                    pass
                try:
                    nutrition_today = int(
                        conn.execute(
                            "SELECT COUNT(*) FROM nutrition_logs WHERE date(logged_at)=date('now')"
                        ).fetchone()[0]
                    )
                except Exception:
                    pass
        except Exception:
            pass

        score = min(
            (focus_velocity * 10)
            + (habit_streak * 2)
            + (tasks_done_today * 3)
            + (journal_today * 5)
            + (review_cards_today * 2)
            + (nutrition_today * 2),
            100,
        )

        # Delta vs yesterday
        delta_vs_yesterday = 0
        try:
            with tx(self.db_path) as conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS packy_momentum_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        score INTEGER NOT NULL,
                        logged_date TEXT NOT NULL DEFAULT (date('now')),
                        UNIQUE(logged_date)
                    )
                    """
                )
                yesterday_row = conn.execute(
                    "SELECT score FROM packy_momentum_log WHERE logged_date = date('now', '-1 day')"
                ).fetchone()
                delta_vs_yesterday = score - (yesterday_row[0] if yesterday_row else score)
                conn.execute(
                    "INSERT INTO packy_momentum_log (score, logged_date) VALUES (?, date('now')) "
                    "ON CONFLICT(logged_date) DO UPDATE SET score=excluded.score",
                    (score,),
                )
        except Exception:
            pass

        if score >= 80:
            level = "peak"
        elif score >= 60:
            level = "flowing"
        elif score >= 35:
            level = "building"
        else:
            level = "low"

        return MomentumScore(
            score=score,
            delta_vs_yesterday=delta_vs_yesterday,
            components={
                "focus": min(1.0, focus_velocity / 10.0),
                "habits": min(1.0, habit_streak / 20.0),
                "review": min(1.0, review_cards_today / 10.0),
                "tasks": min(1.0, tasks_done_today / 5.0),
                "journal": min(1.0, journal_today / 1.0),
                "nutrition": min(1.0, nutrition_today / 3.0),
            },
            level=level,
            summary=(
                f"Momentum is {level}: {focus_velocity} focus sessions, "
                f"{habit_streak} streak pts, {tasks_done_today} tasks done today."
            ),
        )
