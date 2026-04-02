CREATE TABLE IF NOT EXISTS nutrition_entries (
    id TEXT PRIMARY KEY,
    entry_date TEXT NOT NULL,
    food_name TEXT NOT NULL,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    sugar_g REAL,
    fiber_g REAL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
