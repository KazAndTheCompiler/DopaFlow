-- Migration 0025: add user preferences table
-- Generated: 2026-03-31T10:48:11.187826

CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL DEFAULT 'app',
    preference_key TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(namespace, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_namespace
ON user_preferences(namespace);

CREATE INDEX IF NOT EXISTS idx_user_preferences_key
ON user_preferences(preference_key);
