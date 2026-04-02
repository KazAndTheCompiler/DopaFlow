CREATE TABLE IF NOT EXISTS nutrition_foods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kj REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'serving',
    protein_g REAL NOT NULL DEFAULT 0,
    carbs_g REAL NOT NULL DEFAULT 0,
    fat_g REAL NOT NULL DEFAULT 0,
    meal_label TEXT NOT NULL DEFAULT 'snack',
    is_preset INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS nutrition_goals (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE nutrition_entries ADD COLUMN meal_label TEXT NOT NULL DEFAULT 'snack';
ALTER TABLE nutrition_entries ADD COLUMN qty REAL NOT NULL DEFAULT 1.0;
ALTER TABLE nutrition_entries ADD COLUMN food_id TEXT;
