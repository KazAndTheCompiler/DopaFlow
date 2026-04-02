CREATE TABLE IF NOT EXISTS xp_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    source      TEXT NOT NULL,
    source_id   TEXT,
    xp          INTEGER NOT NULL,
    awarded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_source ON xp_ledger(source, awarded_at);

CREATE TABLE IF NOT EXISTS player_level (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    total_xp    INTEGER NOT NULL DEFAULT 0,
    level       INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO player_level (id, total_xp, level) VALUES (1, 0, 1);

CREATE TABLE IF NOT EXISTS badges (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    icon        TEXT NOT NULL,
    earned_at   TEXT,
    progress    REAL NOT NULL DEFAULT 0.0,
    target      INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO badges (id, name, description, icon, target) VALUES
  ('first_task', 'First Step', 'Complete your first task', '✅', 1),
  ('tasks_10', 'Getting Things Done', 'Complete 10 tasks', '📋', 10),
  ('tasks_100', 'Century', 'Complete 100 tasks', '💯', 100),
  ('streak_3', 'Three-peat', '3-day habit streak', '🔥', 3),
  ('streak_7', 'Week Warrior', '7-day habit streak', '⚡', 7),
  ('streak_30', 'Iron Habit', '30-day habit streak', '🏆', 30),
  ('focus_1h', 'In the Zone', 'Accumulate 1 hour of focus time', '🎯', 60),
  ('focus_10h', 'Deep Worker', 'Accumulate 10 hours of focus time', '🧠', 600),
  ('journal_7', 'Reflective', 'Write journal entries 7 days in a row', '📓', 7),
  ('review_50', 'Flashmaster', 'Rate 50 review cards', '🃏', 50),
  ('level_5', 'Levelling Up', 'Reach level 5', '⭐', 5),
  ('level_10', 'Dedicated', 'Reach level 10', '🌟', 10);
