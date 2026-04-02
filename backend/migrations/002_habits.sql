CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    target_freq INTEGER NOT NULL DEFAULT 1,
    target_period TEXT NOT NULL DEFAULT 'day',
    description TEXT,
    color TEXT DEFAULT '#5B6AF0',
    freeze_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS habit_checkins (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id),
    checkin_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(habit_id, checkin_date)
);
CREATE TABLE IF NOT EXISTS habit_goals (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id),
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    target_count INTEGER NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS habit_streaks (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id),
    start_date TEXT NOT NULL,
    end_date TEXT,
    length INTEGER NOT NULL DEFAULT 1
);
