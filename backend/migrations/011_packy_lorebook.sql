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
);
