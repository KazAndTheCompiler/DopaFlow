CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    at TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'once',
    tts_text TEXT,
    youtube_link TEXT,
    muted INTEGER NOT NULL DEFAULT 0,
    last_fired_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS alarms_trigger_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alarm_id TEXT NOT NULL REFERENCES alarms(id),
    at TEXT NOT NULL,
    fired INTEGER NOT NULL DEFAULT 0
);
