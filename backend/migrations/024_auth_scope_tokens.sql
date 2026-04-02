CREATE TABLE IF NOT EXISTS auth_scope_tokens (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    scopes_json TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    issued_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_scope_tokens_expires_at
ON auth_scope_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_auth_scope_tokens_revoked_at
ON auth_scope_tokens(revoked_at);
