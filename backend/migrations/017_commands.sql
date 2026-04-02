CREATE TABLE IF NOT EXISTS commands (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    action_type    TEXT NOT NULL,
    action_payload TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
