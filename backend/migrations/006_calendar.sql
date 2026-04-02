CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    recurrence TEXT,
    source_type TEXT,
    source_external_id TEXT,
    source_instance_id TEXT,
    source_origin_app TEXT DEFAULT 'dopaflow',
    google_event_id TEXT,
    sync_status TEXT NOT NULL DEFAULT 'local_only',
    provider_readonly INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id TEXT NOT NULL,
    object_type TEXT NOT NULL,
    conflict_reason TEXT NOT NULL,
    local_snapshot TEXT,
    incoming_snapshot TEXT,
    field_diffs TEXT,
    owner TEXT NOT NULL DEFAULT 'dopaflow',
    source_context TEXT,
    repair_hint TEXT,
    blocking_severity TEXT NOT NULL DEFAULT 'non_blocking',
    detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TEXT,
    resolved_by TEXT
);
CREATE TABLE IF NOT EXISTS sync_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_id TEXT NOT NULL,
    object_type TEXT NOT NULL,
    deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_by TEXT NOT NULL,
    deletion_origin TEXT NOT NULL,
    snapshot TEXT,
    provider_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_conflicts_object ON sync_conflicts(object_id, object_type);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON sync_conflicts(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tombstones_id ON sync_tombstones(original_id, object_type);
