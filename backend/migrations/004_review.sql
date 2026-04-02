CREATE TABLE IF NOT EXISTS review_decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS review_cards (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES review_decks(id),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    state TEXT NOT NULL DEFAULT 'new',
    ease_factor REAL NOT NULL DEFAULT 2.5,
    last_interval_days INTEGER NOT NULL DEFAULT 0,
    lapse_count INTEGER NOT NULL DEFAULT 0,
    last_rating INTEGER,
    reviews_done INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS review_session_log (
    id TEXT PRIMARY KEY,
    deck_id TEXT NOT NULL REFERENCES review_decks(id),
    card_id TEXT,
    rating INTEGER,
    reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
