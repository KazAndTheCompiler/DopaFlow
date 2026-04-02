CREATE TABLE IF NOT EXISTS journal_versions (
    entry_date     TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    body           TEXT NOT NULL,
    word_count     INTEGER,
    saved_at       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (entry_date, version_number)
);

CREATE INDEX IF NOT EXISTS idx_journal_versions_date
    ON journal_versions(entry_date, version_number DESC);

ALTER TABLE journal_entries ADD COLUMN auto_tags_json TEXT NOT NULL DEFAULT '[]';
