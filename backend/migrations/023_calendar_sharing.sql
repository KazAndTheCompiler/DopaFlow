CREATE TABLE IF NOT EXISTS calendar_share_tokens (
    id           TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    token_hash   TEXT NOT NULL UNIQUE,
    scopes       TEXT NOT NULL DEFAULT 'read:calendar',
    allow_write  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    revoked_at   TEXT
);

CREATE TABLE IF NOT EXISTS calendar_peer_feeds (
    id             TEXT PRIMARY KEY,
    label          TEXT NOT NULL,
    base_url       TEXT NOT NULL,
    token          TEXT NOT NULL,
    allow_write    INTEGER NOT NULL DEFAULT 0,
    color          TEXT NOT NULL DEFAULT '#6366f1',
    sync_status    TEXT NOT NULL DEFAULT 'idle',
    last_synced_at TEXT,
    last_error     TEXT,
    created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_share_tokens_hash   ON calendar_share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_share_tokens_active ON calendar_share_tokens(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_peer_feeds_status   ON calendar_peer_feeds(sync_status);
