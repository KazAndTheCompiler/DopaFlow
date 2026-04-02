CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    markdown_body TEXT NOT NULL DEFAULT '',
    emoji TEXT,
    entry_date TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    locked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    UNIQUE(entry_date)
);
CREATE TABLE IF NOT EXISTS journal_links (
    id TEXT PRIMARY KEY,
    source_entry_id TEXT NOT NULL REFERENCES journal_entries(id),
    target_slug TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_entry_id, target_slug)
);
CREATE INDEX IF NOT EXISTS idx_journal_links_source ON journal_links(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_links_target ON journal_links(target_slug);
