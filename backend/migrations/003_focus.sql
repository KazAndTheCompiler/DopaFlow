CREATE TABLE IF NOT EXISTS focus_sessions (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'active',
    paused_duration_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS focus_active_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    session_id TEXT REFERENCES focus_sessions(id),
    task_id TEXT,
    started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paused_duration_ms INTEGER NOT NULL DEFAULT 0
);
