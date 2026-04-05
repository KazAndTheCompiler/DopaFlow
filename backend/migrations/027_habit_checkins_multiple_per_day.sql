ALTER TABLE habit_checkins RENAME TO habit_checkins_old;

CREATE TABLE habit_checkins (
    id TEXT PRIMARY KEY,
    habit_id TEXT NOT NULL REFERENCES habits(id),
    checkin_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO habit_checkins (id, habit_id, checkin_date, created_at)
SELECT id, habit_id, checkin_date, created_at
FROM habit_checkins_old;

DROP TABLE habit_checkins_old;

CREATE INDEX IF NOT EXISTS idx_habit_checkins_date ON habit_checkins(habit_id, checkin_date);
