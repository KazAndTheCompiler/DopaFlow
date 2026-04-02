ALTER TABLE calendar_share_tokens
ADD COLUMN expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_share_tokens_expires_at
ON calendar_share_tokens(expires_at);
