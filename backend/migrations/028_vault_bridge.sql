-- Vault bridge: file index and configuration tables

CREATE TABLE IF NOT EXISTS vault_file_index (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT NOT NULL,          -- 'journal' | 'task' | 'review'
    entity_id       TEXT NOT NULL,
    file_path       TEXT NOT NULL UNIQUE,   -- relative to vault root, e.g. 'Daily/2026-04-05.md'
    file_hash       TEXT,                   -- sha256 of last written content
    last_synced_at  TEXT,
    last_direction  TEXT,                   -- 'push' | 'pull'
    sync_status     TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'conflict' | 'error'
    snapshot_body   TEXT,                   -- full file content before last write (rollback)
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vault_config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Defaults
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('vault_enabled', 'false');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('vault_path', '');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('daily_note_folder', 'Daily');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('tasks_folder', 'Tasks');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('review_folder', 'Review');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('projects_folder', 'Projects');
INSERT OR IGNORE INTO vault_config (key, value) VALUES ('attachments_folder', 'Attachments');
